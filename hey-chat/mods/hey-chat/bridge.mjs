#!/usr/bin/env node
// The bridge: runs one chat's agent for Hey, chat and keeps it alive between turns.
//
// A mod's exec stops after 30 s, and a turn can wait on you for longer than that, so the mod
// starts this program in a hidden Herdr terminal and talks to it over a local socket instead.
//
//   node bridge.mjs serve --chat <id> --cwd <folder> --state <dir> [--agent claude|codex] [--resume <session>]
//       Listens on 127.0.0.1, writes { port, pid } to <state>/<chat>.json, and runs the chat's agent:
//       Claude Code (`claude -p`, the default) or Codex (`codex app-server`). Ends on "quit", or after
//       30 minutes with no pane connected and no turn running.
//   node bridge.mjs mcp --port <port>
//       Claude starts this itself as a stdio MCP server with one tool, `approve`, which Claude asks
//       (--permission-prompt-tool) whenever your settings don't already allow a tool. It passes the
//       question to the serving bridge and waits for your answer from the pane.
//
// The socket carries one JSON object per line. The first line says who is talking:
//   { role: "pane" }  the mod. It sends { type: "send", text }, { type: "stop" },
//                     { type: "decide", id, behavior: "allow" | "deny", always }, { type: "quit" },
//                     and gets every event since the bridge started, then each new one:
//                     ready, session, user, working, text, tool, tool_done, permission, decided,
//                     turn_end, error.
//   { role: "mcp" }   the approve tool. It sends { type: "ask", tool, input } and gets one
//                     { behavior, ... } line back: the answer Claude expects.
import { spawn } from "node:child_process";
import { createServer, connect } from "node:net";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const IDLE_MS = 30 * 60 * 1000;
/** How much of a tool's output goes to the pane. */
const OUTPUT_MAX = 4000;
/** Bash commands whose "Always allow" rule covers the first two words (`git push`), not just the first. */
const TWO_WORD = new Set(["git", "gh", "npm", "pnpm", "yarn", "bun", "cargo", "go", "docker", "kubectl", "brew", "pip", "uv", "make", "node"]);

/** --name value pairs from argv. @param {string[]} argv */
function flags(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[++i] ?? "";
  return out;
}

/** Splits a stream into lines and hands each complete one to `each`. @param {(line: string) => void} each */
function lines(each) {
  let buf = "";
  return (/** @type {Buffer | string} */ chunk) => {
    buf += chunk.toString();
    let n;
    while ((n = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, n).trim();
      buf = buf.slice(n + 1);
      if (line) each(line);
    }
  };
}

/** @param {string} line */
function parse(line) {
  try { return JSON.parse(line); } catch { return null; }
}

// ---------------------------------------------------------------------------------------------
// mcp: the approve tool

function mcp(opts) {
  const port = Number(opts.port);
  /** @param {any} msg */
  const reply = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...msg })}\n`);
  process.stdin.on("data", lines(async (line) => {
    const m = parse(line);
    if (!m || !m.method) return;
    if (m.method === "initialize") {
      reply({ id: m.id, result: { protocolVersion: m.params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "heychat", version: "1" } } });
    } else if (m.method === "tools/list") {
      reply({ id: m.id, result: { tools: [{
        name: "approve",
        description: "Asks the person in Hey, chat whether a tool may run.",
        inputSchema: { type: "object", properties: { tool_name: { type: "string" }, input: { type: "object" }, tool_use_id: { type: "string" } }, required: ["tool_name", "input"] },
      }] } });
    } else if (m.method === "tools/call") {
      const args = m.params?.arguments ?? {};
      const answer = await askBridge(port, { type: "ask", tool: args.tool_name, input: args.input ?? {}, toolUseId: args.tool_use_id ?? null })
        .catch(() => ({ behavior: "deny", message: "Hey, chat couldn't ask you, so this was not allowed." }));
      reply({ id: m.id, result: { content: [{ type: "text", text: JSON.stringify(answer) }] } });
    } else if (m.method === "ping") {
      reply({ id: m.id, result: {} });
    } else if (m.id !== undefined) {
      reply({ id: m.id, error: { code: -32601, message: `Unknown method ${m.method}` } });
    }
  }));
}

/** Sends one question to the serving bridge and waits for its one-line answer. @param {number} port @param {any} question */
function askBridge(port, question) {
  return new Promise((resolve, reject) => {
    const sock = connect(port, "127.0.0.1");
    sock.on("connect", () => { sock.write(`${JSON.stringify({ role: "mcp" })}\n${JSON.stringify(question)}\n`); });
    sock.on("data", lines((line) => { const a = parse(line); if (a) { resolve(a); sock.end(); } }));
    sock.on("error", reject);
    sock.on("close", () => reject(new Error("closed")));
  });
}

// ---------------------------------------------------------------------------------------------
// serve: one chat

function serve(opts) {
  const chat = opts.chat, cwd = opts.cwd, state = opts.state;
  const agent = opts.agent === "codex" ? "codex" : "claude";
  let session = opts.resume || null;
  let turn = false;         // a turn is running
  /** @type {any[]} */
  const history = [];       // every event so far, for a pane that connects later
  /** @type {Set<import("node:net").Socket>} */
  const panes = new Set();
  /**
   * Questions waiting on you, by id. `answer` replies to whoever asked: the approve tool's
   * socket for Claude, the app-server's request for Codex.
   * @type {Map<string, { tool: string, input: any, answer: (allow: boolean, always: boolean) => void }>}
   */
  const pending = new Map();
  let asks = 0;
  let lastSeen = Date.now();

  /** @param {any} ev */
  const emit = (ev) => {
    history.push(ev);
    const line = `${JSON.stringify(ev)}\n`;
    for (const p of panes) p.write(line);
  };

  /** @param {string | null} id */
  const setSession = (id) => { if (id && id !== session) { session = id; emit({ type: "session", id }); } };

  /** Puts a question to the pane. @param {string} tool @param {any} input @param {string | null} toolUseId @param {(allow: boolean, always: boolean) => void} answer */
  const ask = (tool, input, toolUseId, answer) => {
    const id = `ask${++asks}`;
    pending.set(id, { tool, input, answer });
    emit({ type: "permission", id, tool, input, toolUseId });
    return id;
  };

  /** Withdraws a question nobody can answer any more. @param {string} id */
  const withdraw = (id) => { if (pending.delete(id)) emit({ type: "decided", id, behavior: "deny" }); };

  /** @param {string} message */
  const denyAll = (message) => {
    for (const [id, p] of pending) { p.answer(false, false); emit({ type: "decided", id, behavior: "deny", message }); }
    pending.clear();
  };

  /** @param {boolean} error @param {string} [text] @param {boolean} [stopped] */
  const endTurn = (error, text = "", stopped = false) => {
    if (!turn) return;
    turn = false;
    denyAll("The turn ended.");
    emit(stopped ? { type: "turn_end", stopped: true } : { type: "turn_end", error, text });
  };

  const driver = agent === "codex" ? codexDriver() : claudeDriver();

  // -------------------------------------------------------------------------------------------
  // Claude Code: `claude -p` reading stream-json, one process for many turns.

  function claudeDriver() {
    /** @type {import("node:child_process").ChildProcess | null} */
    let proc = null;
    let stopping = false;     // the pane asked to stop the turn
    /** @type {any} */
    let killTimer = null;     // ends Claude when SIGINT didn't stop the turn
    let stderr = "";
    /** @type {{ tool: string, prefix?: string }[]} */
    const always = [];        // "Always allow" answers from this run

    const start = () => {
      const port = /** @type {any} */ (server.address()).port;
      const mcpConfig = { mcpServers: { heychat: { command: process.execPath, args: [SELF, "mcp", "--port", String(port)] } } };
      const args = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
        "--permission-prompt-tool", "mcp__heychat__approve", "--mcp-config", JSON.stringify(mcpConfig),
        ...(session ? ["--resume", session] : [])];
      stderr = "";
      const child = spawn("claude", args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
      proc = child;
      child.stdout.on("data", lines((line) => fromClaude(parse(line))));
      child.stderr.on("data", (d) => { stderr = (stderr + d.toString()).slice(-2000); });
      child.on("error", (e) => { emit({ type: "error", message: `Couldn't start claude: ${e.message}` }); });
      child.on("exit", (code) => {
        // A Claude the bridge already let go (after a stop) no longer owns the turn.
        if (proc !== child) return;
        proc = null;
        if (stopping) { stopping = false; endTurn(false, "", true); }
        else endTurn(true, stderr.trim() || `claude stopped (exit ${code}).`);
      });
    };

    /** @param {any} ev a line of Claude's stream-json */
    const fromClaude = (ev) => {
      if (!ev) return;
      setSession(ev.session_id ?? null);
      if (ev.type === "assistant") {
        for (const c of ev.message?.content ?? []) {
          if (c.type === "text" && c.text?.trim()) emit({ type: "text", text: c.text });
          else if (c.type === "tool_use") emit({ type: "tool", id: c.id, name: c.name, input: c.input ?? {} });
        }
      } else if (ev.type === "user") {
        const content = ev.message?.content;
        if (Array.isArray(content)) for (const c of content) {
          if (c.type !== "tool_result") continue;
          const out = Array.isArray(c.content) ? c.content.map((/** @type {any} */ x) => x.text ?? "").join("\n") : String(c.content ?? "");
          emit({ type: "tool_done", id: c.tool_use_id, error: Boolean(c.is_error), output: out.slice(0, OUTPUT_MAX) });
        }
      } else if (ev.type === "result" || (ev.stop_reason !== undefined && ev.duration_api_ms !== undefined)) {
        // Claude takes SIGINT as "stop this turn", then exits. It's let go here, so the next message
        // starts a new one with --resume instead of racing the old one's exit.
        if (stopping) {
          stopping = false; clearTimeout(killTimer);
          const child = proc; proc = null; child?.kill("SIGTERM");
          endTurn(false, "", true);
          return;
        }
        const error = Boolean(ev.is_error) || (ev.subtype && ev.subtype !== "success");
        endTurn(error, error ? String(ev.result ?? ev.subtype ?? "The turn failed.") : "");
      }
    };

    /** True when an "Always allow" answer from this run covers the call. @param {string} tool @param {any} input */
    const allowedAlready = (tool, input) => always.some((r) => r.tool === tool && (!r.prefix || String(input?.command ?? "").trim().startsWith(r.prefix)));

    /** The "Always allow" rule for a call, as Claude's settings write it. @param {string} tool @param {any} input */
    const ruleFor = (tool, input) => {
      if (tool !== "Bash") return { tool, rule: tool };
      const words = String(input?.command ?? "").trim().split(/\s+/);
      const n = TWO_WORD.has(words[0]) && words[1] && !words[1].startsWith("-") ? 2 : 1;
      const prefix = words.slice(0, n).join(" ");
      return { tool, prefix, rule: `Bash(${prefix}:*)` };
    };

    /** Adds an allow rule to the folder's .claude/settings.local.json, as Claude's own "don't ask again" does. @param {string} rule */
    const saveRule = (rule) => {
      const file = join(cwd, ".claude", "settings.local.json");
      let s = {};
      try { s = JSON.parse(readFileSync(file, "utf8")); } catch { /* new file */ }
      const perms = /** @type {any} */ (s).permissions ?? {};
      const allow = Array.isArray(perms.allow) ? perms.allow : [];
      if (!allow.includes(rule)) allow.push(rule);
      /** @type {any} */ (s).permissions = { ...perms, allow };
      try { mkdirSync(join(cwd, ".claude"), { recursive: true }); writeFileSync(file, `${JSON.stringify(s, null, 2)}\n`); } catch { /* the run still allows it */ }
    };

    return {
      /** @param {string} text */
      send(text) {
        if (!proc) start();
        proc?.stdin?.write(`${JSON.stringify({ type: "user", message: { role: "user", content: text } })}\n`);
      },
      stop() {
        // SIGINT first. Only when Claude hasn't ended the turn 5 s later is it ended for good
        // (the next message starts it again with --resume).
        if (!proc || stopping) return;
        stopping = true;
        const child = proc;
        child.kill("SIGINT");
        killTimer = setTimeout(() => { if (stopping && proc === child) child.kill("SIGTERM"); }, 5000);
      },
      kill() { proc?.kill("SIGTERM"); },
      /** The approve tool's question. @param {import("node:net").Socket} sock @param {any} q */
      approve(sock, q) {
        if (q?.type !== "ask") return;
        const reply = (/** @type {any} */ a) => sock.end(`${JSON.stringify(a)}\n`);
        if (allowedAlready(q.tool, q.input)) { reply({ behavior: "allow", updatedInput: q.input }); return; }
        const id = ask(q.tool, q.input, q.toolUseId ?? null, (allow, alwaysToo) => {
          if (allow && alwaysToo) { const r = ruleFor(q.tool, q.input); always.push(r); saveRule(r.rule); }
          reply(allow ? { behavior: "allow", updatedInput: q.input } : { behavior: "deny", message: "The user said no." });
        });
        sock.on("close", () => withdraw(id));
      },
    };
  }

  // -------------------------------------------------------------------------------------------
  // Codex: `codex app-server`, JSON-RPC over stdio, the protocol Codex's own apps use. Tested with
  // codex-cli 0.162.1. Approvals arrive as requests from the server and are answered by id.

  function codexDriver() {
    /** @type {import("node:child_process").ChildProcess | null} */
    let proc = null;
    /** @type {Promise<void> | null} */
    let ready = null;
    let rpcId = 0;
    /** @type {Map<number, { resolve: (r: any) => void, reject: (e: Error) => void }>} */
    const calls = new Map();
    let turnId = /** @type {string | null} */ (null);
    let stderr = "";
    /** Items by id, for an approval that names an item (a file change's diffs). @type {Map<string, any>} */
    const items = new Map();

    /** @param {any} msg */
    const write = (msg) => proc?.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", ...msg })}\n`);
    /** @param {string} method @param {any} params @returns {Promise<any>} */
    const call = (method, params) => new Promise((resolve, reject) => {
      const id = ++rpcId;
      calls.set(id, { resolve, reject });
      write({ id, method, params });
    });

    const start = () => {
      stderr = "";
      const child = spawn("codex", ["app-server"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
      proc = child;
      child.stdout.on("data", lines((line) => fromCodex(parse(line))));
      child.stderr.on("data", (d) => { stderr = (stderr + d.toString()).slice(-2000); });
      child.on("error", (e) => { emit({ type: "error", message: `Couldn't start codex: ${e.message}` }); });
      child.on("exit", (code) => {
        if (proc !== child) return;
        proc = null; ready = null;
        for (const c of calls.values()) c.reject(new Error(stderr.trim() || `codex stopped (exit ${code}).`));
        calls.clear();
        endTurn(true, stderr.trim() || `codex stopped (exit ${code}).`);
      });
      ready = (async () => {
        await call("initialize", { clientInfo: { name: "hey-chat", title: "Hey, chat", version: "1" }, capabilities: null });
        write({ method: "initialized", params: {} });
        const r = session ? await call("thread/resume", { threadId: session, cwd }) : await call("thread/start", { cwd });
        setSession(r?.thread?.id ?? null);
      })();
    };

    /** The words for a file change: its paths, and its diffs as + and - lines. @param {any} item */
    const patchInput = (item) => ({ changes: (item?.changes ?? []).map((/** @type {any} */ c) => ({ path: c.path, kind: c.kind?.type ?? "update", diff: String(c.diff ?? "") })) });

    /** @param {any} m a JSON-RPC message from the app-server */
    const fromCodex = (m) => {
      if (!m) return;
      // A reply to one of our calls.
      if (m.id !== undefined && !m.method) {
        const c = calls.get(m.id);
        if (!c) return;
        calls.delete(m.id);
        if (m.error) c.reject(new Error(String(m.error.message ?? "Codex refused that.")));
        else c.resolve(m.result);
        return;
      }
      // A request from the server: approvals become questions, anything else is turned down.
      if (m.id !== undefined && m.method) {
        const p = m.params ?? {};
        if (m.method === "item/commandExecution/requestApproval" || m.method === "execCommandApproval") {
          const command = p.commandActions?.[0]?.command ?? (Array.isArray(p.command) ? p.command.join(" ") : p.command) ?? "";
          const v1 = m.method === "execCommandApproval";
          ask("Bash", { command, description: p.reason ?? undefined }, p.itemId ?? p.callId ?? null, (allow, always) =>
            write({ id: m.id, result: { decision: v1 ? (allow ? (always ? "approved_for_session" : "approved") : "denied") : (allow ? (always ? "acceptForSession" : "accept") : "decline") } }));
        } else if (m.method === "item/fileChange/requestApproval" || m.method === "applyPatchApproval") {
          const v1 = m.method === "applyPatchApproval";
          const input = v1 ? { changes: Object.entries(p.fileChanges ?? {}).map(([path, c]) => ({ path, kind: "update", diff: String(/** @type {any} */ (c)?.unified_diff ?? "") })) } : patchInput(items.get(p.itemId));
          ask("CodexPatch", input, p.itemId ?? p.callId ?? null, (allow, always) =>
            write({ id: m.id, result: { decision: v1 ? (allow ? (always ? "approved_for_session" : "approved") : "denied") : (allow ? (always ? "acceptForSession" : "accept") : "decline") } }));
        } else {
          write({ id: m.id, error: { code: -32601, message: `Hey, chat doesn't handle ${m.method}.` } });
        }
        return;
      }
      const p = m.params ?? {};
      switch (m.method) {
        case "thread/started": setSession(p.thread?.id ?? null); break;
        case "turn/started": turnId = p.turn?.id ?? turnId; break;
        case "item/started": {
          const it = p.item;
          if (!it) break;
          items.set(it.id, it);
          if (it.type === "commandExecution") emit({ type: "tool", id: it.id, name: "Bash", input: { command: it.commandActions?.[0]?.command ?? it.command } });
          else if (it.type === "fileChange") emit({ type: "tool", id: it.id, name: "CodexPatch", input: patchInput(it) });
          else if (it.type === "mcpToolCall") emit({ type: "tool", id: it.id, name: `${it.server}.${it.tool}`, input: it.arguments ?? {} });
          else if (it.type === "webSearch") emit({ type: "tool", id: it.id, name: "WebSearch", input: { query: it.query ?? "" } });
          break;
        }
        case "item/completed": {
          const it = p.item;
          if (!it) break;
          items.set(it.id, it);
          if (it.type === "agentMessage" && String(it.text ?? "").trim()) emit({ type: "text", text: it.text });
          else if (it.type === "commandExecution") emit({ type: "tool_done", id: it.id, error: it.status !== "completed" || (it.exitCode ?? 0) !== 0, output: String(it.aggregatedOutput ?? "").slice(0, OUTPUT_MAX) });
          else if (it.type === "fileChange") emit({ type: "tool_done", id: it.id, error: it.status !== "completed", output: "" });
          else if (it.type === "mcpToolCall") emit({ type: "tool_done", id: it.id, error: Boolean(it.error), output: JSON.stringify(it.result ?? it.error ?? "").slice(0, OUTPUT_MAX) });
          else if (it.type === "webSearch") emit({ type: "tool_done", id: it.id, error: false, output: "" });
          break;
        }
        case "turn/completed": {
          const status = p.turn?.status;
          turnId = null;
          if (status === "interrupted") endTurn(false, "", true);
          else if (status === "failed") endTurn(true, String(p.turn?.error?.message ?? "The turn failed."));
          else endTurn(false);
          break;
        }
        default: break;
      }
    };

    return {
      /** @param {string} text */
      send(text) {
        if (!proc) start();
        (async () => {
          try {
            await ready;
            const r = await call("turn/start", { threadId: session, input: [{ type: "text", text, text_elements: [] }] });
            turnId = r?.turn?.id ?? turnId;
          } catch (e) {
            endTurn(true, e instanceof Error ? e.message : String(e));
          }
        })();
      },
      stop() {
        if (proc && session && turnId) call("turn/interrupt", { threadId: session, turnId }).catch(() => endTurn(false, "", true));
      },
      kill() { proc?.kill("SIGTERM"); },
      /** Codex has no approve tool. @param {import("node:net").Socket} sock */
      approve(sock) { sock.end(`${JSON.stringify({ behavior: "deny", message: "Not used by Codex." })}\n`); },
    };
  }

  // -------------------------------------------------------------------------------------------
  // The pane's messages, and the socket.

  /** @param {any} m */
  const fromPane = (m) => {
    if (!m) return;
    if (m.type === "send" && typeof m.text === "string") {
      if (turn) return;
      turn = true;
      emit({ type: "user", text: m.text, at: Date.now() });
      emit({ type: "working" });
      driver.send(m.text);
    } else if (m.type === "stop") {
      if (turn) driver.stop();
    } else if (m.type === "decide") {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      const allow = m.behavior === "allow";
      p.answer(allow, Boolean(allow && m.always));
      emit({ type: "decided", id: m.id, behavior: allow ? "allow" : "deny", always: Boolean(allow && m.always) });
    } else if (m.type === "quit") {
      quit();
    }
  };

  const quit = () => {
    denyAll("Hey, chat closed.");
    driver.kill();
    try { rmSync(join(state, `${chat}.json`)); } catch { /* already gone */ }
    process.exit(0);
  };

  const server = createServer((sock) => {
    /** @type {string | null} */
    let role = null;
    sock.on("data", lines((line) => {
      const m = parse(line);
      if (role === null) {
        role = m?.role ?? "pane";
        if (role === "pane") {
          panes.add(sock); lastSeen = Date.now();
          for (const ev of history) sock.write(`${JSON.stringify(ev)}\n`);
        }
        return;
      }
      if (role === "pane") fromPane(m); else driver.approve(sock, m);
    }));
    sock.on("close", () => { if (panes.delete(sock)) lastSeen = Date.now(); });
    sock.on("error", () => { /* the close handler tidies up */ });
  });

  server.listen(0, "127.0.0.1", () => {
    mkdirSync(state, { recursive: true });
    const port = /** @type {any} */ (server.address()).port;
    writeFileSync(join(state, `${chat}.json`), JSON.stringify({ port, pid: process.pid, cwd, agent }));
    emit({ type: "ready", session, agent });
  });

  setInterval(() => {
    if (panes.size === 0 && !turn && Date.now() - lastSeen > IDLE_MS) quit();
  }, 60 * 1000);
  process.on("SIGTERM", quit);
  process.on("SIGHUP", quit);
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "mcp") mcp(flags(rest));
else if (mode === "serve") serve(flags(rest));
else { process.stderr.write("usage: bridge.mjs serve --chat <id> --cwd <folder> --state <dir> [--agent claude|codex] [--resume <session>] | mcp --port <port>\n"); process.exit(2); }
