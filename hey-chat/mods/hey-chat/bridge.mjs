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
//   { role: "pane" }  the mod. It sends { type: "send", text, images, skill? }, { type: "compact" }, { type: "stop" },
//                     { type: "answer", id, answers: { <question id>: [answer, …] } } for the agent's questions,
//                     { type: "decide", id, behavior: "allow" | "deny", always }, { type: "quit" },
//                     and gets every event since the bridge started, then each new one:
//                     ready, session, user, working, text, image, note, tool, tool_done,
//                     permission, question, decided, answered, turn_end, error.
//   { role: "mcp" }   the approve tool. It sends { type: "ask", tool, input } and gets one
//                     { behavior, ... } line back: the answer Claude expects.
import { spawnAgent as spawn } from "./process.mjs";
import { createServer, connect } from "node:net";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { keepFile, keepBase64, pathsIn, fileOf, mediaType } from "./images.mjs";

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

/** Waits until the agent has released its session, including when it ignores SIGTERM. */
function terminate(child) {
  if (!child || child.exitCode != null || child.signalCode != null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.kill("SIGTERM");
  });
}

/** Finds a session's bridge when the pane lost its original chat id. */
async function findBridge(opts) {
  if (!opts.resume) return null;
  let files;
  try { files = readdirSync(opts.state); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
  const found = await Promise.all(files.filter(file => file.endsWith(".json")).map(async file => {
    let saved;
    try { saved = JSON.parse(readFileSync(join(opts.state, file), "utf8")); } catch { return null; }
    if (saved.agent !== opts.agent) return null;
    // Read the replay as well: older bridges did not save their session in the registry.
    return new Promise(resolve => {
      const sock = connect(saved.port, "127.0.0.1");
      const finish = value => { clearTimeout(timer); sock.destroy(); resolve(value); };
      const timer = setTimeout(() => finish(null), 500);
      sock.on("connect", () => sock.write(`${JSON.stringify({ role: "pane" })}\n`));
      sock.on("data", lines(line => {
        const ev = parse(line);
        if ((ev?.type === "ready" && ev.session === opts.resume) || (ev?.type === "session" && ev.id === opts.resume)) finish(saved);
      }));
      sock.on("error", () => finish(null));
      sock.on("end", () => finish(null));
    });
  }));
  return found.find(Boolean) ?? null;
}

/** Ends an existing bridge without starting a new one or requiring a pane connection. */
async function quitBridge(opts) {
  let saved;
  try { saved = JSON.parse(readFileSync(join(opts.state, `${opts.chat}.json`), "utf8")); }
  catch (e) { if (e.code !== "ENOENT") throw e; }
  saved ??= await findBridge(opts);
  if (!saved) return;
  const { port } = saved;
  await new Promise((resolve, reject) => {
    const sock = connect(port, "127.0.0.1");
    const timer = setTimeout(() => { sock.destroy(); reject(new Error("The chat's agent did not shut down. Try deleting again.")); }, 10000);
    sock.on("connect", () => sock.write(`${JSON.stringify({ role: "pane" })}\n${JSON.stringify({ type: "quit" })}\n`));
    sock.on("data", () => {}); // Drain the bridge's replay while waiting for shutdown.
    sock.on("end", () => { clearTimeout(timer); resolve(); });
    sock.on("error", (e) => {
      clearTimeout(timer);
      if (e.code === "ECONNREFUSED") resolve(); else reject(e);
    });
  });
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
  const selectedModel = opts.model || null;
  let turn = false;         // a turn is running
  const queue = [];
  const submitted = new Set();
  let messageId = 0;
  /** @type {any[]} */
  const history = [];       // every event so far, for a pane that connects later
  /** @type {Set<import("node:net").Socket>} */
  const panes = new Set();
  /**
   * Questions waiting on you, by id. `answer` replies to whoever asked: the approve tool's
   * socket for Claude, the app-server's request for Codex.
   * @type {Map<string, { tool: string, input: any, async?: boolean, answer: (allow: boolean, always: boolean, answers?: Record<string, string[]>) => void }>}
   */
  const pending = new Map();
  let asks = 0;
  let lastSeen = Date.now();
  const startedAt = Date.now();

  /** @param {any} ev */
  const emit = (ev) => {
    history.push(ev);
    const line = `${JSON.stringify(ev)}\n`;
    for (const p of panes) p.write(line);
  };

  // Images: the ones you send are already in the images folder. The ones the agent shows (an image
  // it reads or views, or a full path to one in its words) are copied there for the pane.
  const imageDir = join(dirname(state), "images");
  /** @param {{ path: string, w: number, h: number } | null} img */
  const showImage = (img) => { if (img) emit({ type: "image", path: img.path, w: img.w, h: img.h }); };
  /** The agent's words, then each image file they name. @param {string} text */
  const emitText = (text) => {
    emit({ type: "text", text });
    for (const file of pathsIn(text)) showImage(keepFile(file, imageDir));
  };

  /** @param {string | null} id */
  const setSession = (id) => { if (id && id !== session) { session = id; emit({ type: "session", id }); } };
  let model = null;
  /** The actual model reported by the agent, rather than a configured default. @param {any} value */
  const setModel = (value) => {
    if (typeof value === "string" && value && !value.startsWith("<") && value !== model) {
      model = value; emit({ type: "model", model });
    }
  };

  /** Puts a question to the pane. @param {string} tool @param {any} input @param {string | null} toolUseId @param {(allow: boolean, always: boolean) => void} answer */
  const ask = (tool, input, toolUseId, answer) => {
    const id = `ask${++asks}`;
    pending.set(id, { tool, input, answer });
    emit({ type: "permission", id, tool, input, toolUseId });
    return id;
  };

  /**
   * Puts the agent's own questions to the pane: { id, header, question, options, multi } each.
   * `answer` gets each question's picked or typed answers by its id, or null when you dismiss them.
   * @param {any[]} questions @param {(answers: Record<string, string[]> | null) => void} answer
   * @param {boolean} [asynchronous] stays answerable after the agent finishes its turn
   */
  const askQuestions = (questions, answer, asynchronous = false) => {
    const id = `ask${++asks}`;
    pending.set(id, { tool: "question", input: questions, async: asynchronous, answer: (allow, _always, answers) => answer(allow && answers ? answers : null) });
    emit({ type: "question", id, questions, async: asynchronous });
    return id;
  };

  /** Withdraws a question nobody can answer any more. @param {string} id */
  const withdraw = (id) => { if (pending.delete(id)) emit({ type: "decided", id, behavior: "deny" }); };

  /** @param {string} message @param {boolean} [keepAsync] */
  const denyAll = (message, keepAsync = false) => {
    for (const [id, p] of pending) {
      if (keepAsync && p.async) continue;
      pending.delete(id);
      p.answer(false, false); emit({ type: "decided", id, behavior: "deny", message });
    }
  };

  /** @param {boolean} error @param {string} [text] @param {boolean} [stopped] */
  const endTurn = (error, text = "", stopped = false) => {
    if (!turn) return;
    turn = false;
    denyAll("The turn ended.", !error && !stopped);
    emit(stopped ? { type: "turn_end", stopped: true } : { type: "turn_end", error, text });
    if (queue[0]?.interrupting) { queue[0].interrupting = false; drainQueue(); }
    else if (!error && !stopped) drainQueue();
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
        ...(session ? ["--resume", session] : []), ...(selectedModel ? ["--model", selectedModel] : [])];
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
      if (ev.type === "system" && ev.subtype === "init") setModel(ev.model);
      if (ev.type === "assistant") setModel(ev.message?.model);
      if (ev.type === "assistant") {
        for (const c of ev.message?.content ?? []) {
          if (c.type === "text" && c.text?.trim()) emitText(c.text);
          else if (c.type === "tool_use") emit({ type: "tool", id: c.id, name: c.name, input: c.input ?? {} });
        }
      } else if (ev.type === "user") {
        const content = ev.message?.content;
        if (Array.isArray(content)) for (const c of content) {
          if (c.type !== "tool_result") continue;
          const out = Array.isArray(c.content) ? c.content.map((/** @type {any} */ x) => x.text ?? "").join("\n") : String(c.content ?? "");
          emit({ type: "tool_done", id: c.tool_use_id, error: Boolean(c.is_error), output: out.slice(0, OUTPUT_MAX) });
          // An image the tool gave Claude (Read of a picture, a screenshot).
          if (Array.isArray(c.content)) for (const x of c.content) if (x.type === "image") showImage(keepBase64(x.source?.data, x.source?.media_type, imageDir));
        }
      } else if (ev.type === "system" && ev.subtype === "compact_boundary") {
        emit({ type: "note", text: ev.compact_metadata?.trigger === "auto" ? "Chat compacted automatically." : "Chat compacted." });
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
      /** @param {string} text @param {{ path: string }[]} images */
      send(text, images) {
        if (!proc) start();
        /** @type {any[]} */
        const content = [];
        for (const img of images) {
          const file = fileOf(img.path, imageDir);
          try { content.push({ type: "image", source: { type: "base64", media_type: mediaType(file), data: readFileSync(file).toString("base64") } }); } catch { /* gone */ }
        }
        if (text) content.push({ type: "text", text });
        proc?.stdin?.write(`${JSON.stringify({ type: "user", message: { role: "user", content: content.length === 1 && text ? text : content } })}\n`);
      },
      /** Claude compacts on its own /compact command. */
      compact() { this.send("/compact", []); },
      stop() {
        // SIGINT first. Only when Claude hasn't ended the turn 5 s later is it ended for good
        // (the next message starts it again with --resume).
        if (!proc || stopping) return;
        stopping = true;
        const child = proc;
        child.kill("SIGINT");
        killTimer = setTimeout(() => { if (stopping && proc === child) child.kill("SIGTERM"); }, 5000);
      },
      kill() { return terminate(proc); },
      /** The approve tool's question. @param {import("node:net").Socket} sock @param {any} q */
      approve(sock, q) {
        if (q?.type !== "ask") return;
        const reply = (/** @type {any} */ a) => sock.end(`${JSON.stringify(a)}\n`);
        // AskUserQuestion: Claude's questions for you. Your answers go back in its input, keyed by
        // question text, several picks joined with ", " (as Claude Code's own picker answers).
        if (q.tool === "AskUserQuestion") {
          const qs = Array.isArray(q.input?.questions) ? q.input.questions : [];
          const id = askQuestions(qs.map((/** @type {any} */ x) => ({ id: String(x.question ?? ""), header: String(x.header ?? ""), question: String(x.question ?? ""),
            options: (x.options ?? []).map((/** @type {any} */ o) => ({ label: String(o.label ?? ""), description: String(o.description ?? "") })), multi: Boolean(x.multiSelect) })),
          (answers) => reply(answers
            ? { behavior: "allow", updatedInput: { ...q.input, answers: Object.fromEntries(qs.map((/** @type {any} */ x) => [x.question, (answers[x.question] ?? []).join(", ")])) } }
            : { behavior: "deny", message: "The user dismissed the question without answering." }));
          sock.on("close", () => withdraw(id));
          return;
        }
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
    let startingTurn = Promise.resolve();
    let stderr = "";
    /** Items by id, for an approval that names an item (a file change's diffs). @type {Map<string, any>} */
    const items = new Map();
    /** App-server request id → the pane's question id. @type {Map<string | number, string>} */
    const questions = new Map();

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
        await call("initialize", { clientInfo: { name: "hey-chat", title: "Hey, chat", version: "1" }, capabilities: { experimentalApi: true } });
        write({ method: "initialized", params: {} });
        const options = { cwd, ...(selectedModel ? { model: selectedModel } : {}) };
        const r = session ? await call("thread/resume", { threadId: session, ...options }) : await call("thread/start", options);
        setSession(r?.thread?.id ?? null);
        setModel(r?.model);
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
        } else if (m.method === "item/tool/requestUserInput") {
          // Codex's questions for you. Answers go back by question id; dismissed ones get none.
          const qs = Array.isArray(p.questions) ? p.questions : [];
          const id = askQuestions(qs.map((/** @type {any} */ x) => ({ id: String(x.id), header: String(x.header ?? ""), question: String(x.question ?? ""),
            options: (x.options ?? []).map((/** @type {any} */ o) => ({ label: String(o.label ?? ""), description: String(o.description ?? "") })), multi: false, secret: Boolean(x.isSecret) })),
          (answers) => write({ id: m.id, result: { answers: Object.fromEntries(qs.map((/** @type {any} */ x) => [x.id, { answers: answers?.[x.id] ?? [] }])) } }));
          questions.set(m.id, id);
        } else {
          write({ id: m.id, error: { code: -32601, message: `Hey, chat doesn't handle ${m.method}.` } });
        }
        return;
      }
      const p = m.params ?? {};
      switch (m.method) {
        case "model/rerouted": setModel(p.toModel); break;
        case "serverRequest/resolved": {
          const id = questions.get(p.requestId);
          if (id) { withdraw(id); questions.delete(p.requestId); }
          break;
        }
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
          if (it.type === "agentMessage") {
            if (String(it.text ?? "").trim()) emitText(it.text);
            if (Array.isArray(it.questions) && it.questions.length) {
              const qs = it.questions.map((q, index) => ({ id: `${it.id}-${index}`, header: "", question: String(q.title ?? ""),
                options: (q.options ?? []).map(label => ({ label: String(label), description: "" })), multi: false }));
              askQuestions(qs, answers => {
                if (!answers) return;
                const text = qs.map(q => `${q.question}\n${(answers[q.id] ?? []).join(", ")}`).join("\n\n");
                const active = turn;
                turn = true;
                emit({ type: "user", text, images: [], at: Date.now() });
                if (!active) emit({ type: "working" });
                const input = [{ type: "text", text, text_elements: [] }];
                call(active ? "turn/steer" : "turn/start", { threadId: session, input, ...(active ? { expectedTurnId: turnId } : selectedModel ? { model: selectedModel } : {}) })
                  .then(r => { turnId = r?.turn?.id ?? turnId; })
                  .catch(e => endTurn(true, e instanceof Error ? e.message : String(e)));
              }, true);
            }
          }
          else if (it.type === "contextCompaction") emit({ type: "note", text: "Chat compacted." });
          else if (it.type === "imageView") showImage(keepFile(String(it.path ?? ""), imageDir));
          else if (it.type === "imageGeneration" && it.savedPath) showImage(keepFile(String(it.savedPath), imageDir));
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
      /**
       * A skill you picked from the / menu goes in as a skill input, and its /name comes off the text.
       * @param {string} text @param {{ path: string }[]} images @param {{ name: string, path: string } | null} [skill]
       */
      send(text, images, skill = null) {
        if (!proc) start();
        const words = skill ? text.replace(/^\/\S+\s*/, "") : text;
        const input = [
          ...(skill ? [{ type: "skill", name: skill.name, path: skill.path }] : []),
          ...images.map((img) => ({ type: "localImage", path: fileOf(img.path, imageDir) })),
          ...(words ? [{ type: "text", text: words, text_elements: [] }] : []),
        ];
        startingTurn = (async () => {
          try {
            await ready;
            const r = await call("turn/start", { threadId: session, input, ...(selectedModel ? { model: selectedModel } : {}) });
            turnId = r?.turn?.id ?? turnId;
          } catch (e) {
            endTurn(true, e instanceof Error ? e.message : String(e));
          }
        })();
      },
      /** Adds input to the live turn without interrupting its tools. */
      async steer(text, images, skill) {
        await ready;
        await startingTurn;
        if (!turnId) throw new Error("The active turn has ended.");
        const input = [
          ...(skill ? [{ type: "skill", name: skill.name, path: skill.path }] : []),
          ...images.map(img => ({ type: "localImage", path: fileOf(img.path, imageDir) })),
          ...(text ? [{ type: "text", text: skill ? text.replace(/^\/\S+\s*/, "") : text, text_elements: [] }] : []),
        ];
        await call("turn/steer", { threadId: session, expectedTurnId: turnId, input });
      },
      /** Codex compacts as a turn of its own. */
      compact() {
        if (!proc) start();
        (async () => {
          try { await ready; await call("thread/compact/start", { threadId: session }); }
          catch (e) { endTurn(true, e instanceof Error ? e.message : String(e)); }
        })();
      },
      stop() {
        if (proc && session && turnId) call("turn/interrupt", { threadId: session, turnId }).catch(() => endTurn(false, "", true));
      },
      kill() { return terminate(proc); },
      /** Codex has no approve tool. @param {import("node:net").Socket} sock */
      approve(sock) { sock.end(`${JSON.stringify({ behavior: "deny", message: "Not used by Codex." })}\n`); },
    };
  }

  // -------------------------------------------------------------------------------------------
  // The pane's messages, and the socket.

  const deliver = (entry) => {
    queue.splice(queue.indexOf(entry), 1);
    emit({ type: "user", queueId: entry.id, text: entry.text, images: entry.images, at: entry.at });
  };
  const startMessage = (entry) => {
    turn = true;
    deliver(entry);
    emit({ type: "working" });
    driver.send(entry.text, entry.images, entry.skill);
  };
  const drainQueue = () => {
    if (!turn && queue.length && !queue[0].steering) startMessage(queue[0]);
  };
  const sendNow = async (entry) => {
    if (!entry || entry.steering || entry.interrupting) return;
    if (!turn) { startMessage(entry); return; }
    if (agent === "claude") {
      // Claude's streaming CLI has no turn/steer RPC. Resume with the selected message after interrupting.
      queue.splice(queue.indexOf(entry), 1); queue.unshift(entry);
      entry.interrupting = true;
      driver.stop();
      return;
    }
    entry.steering = true;
    try {
      await driver.steer(entry.text, entry.images, entry.skill);
      deliver(entry);
    } catch (e) {
      entry.steering = false;
      emit({ type: "queue_error", id: entry.id, message: e instanceof Error ? e.message : String(e) });
    }
    if (!turn) drainQueue();
  };

  /** @param {any} m */
  const fromPane = (m) => {
    if (!m || quitting) return;
    if (m.type === "send" && typeof m.text === "string") {
      // Pictures you pasted: { path, w, h } each, already in the images folder.
      const images = (Array.isArray(m.images) ? m.images : []).filter((/** @type {any} */ i) => typeof i?.path === "string");
      const skill = m.skill && typeof m.skill.name === "string" && typeof m.skill.path === "string" ? m.skill : null;
      if (!m.text && images.length === 0) return;
      const id = typeof m.id === "string" ? m.id : `message-${++messageId}`;
      if (submitted.has(id)) return;
      submitted.add(id);
      const entry = { id, text: m.text, images, skill, at: Date.now(), steering: false, interrupting: false };
      queue.push(entry);
      if (turn || queue.length > 1) emit({ type: "queued", ...entry });
      drainQueue();
    } else if (m.type === "send_now") {
      void sendNow(queue.find(entry => entry.id === m.id));
    } else if (m.type === "compact") {
      if (turn) return;
      if (!session) { emit({ type: "note", text: "Nothing to compact yet." }); return; }
      turn = true;
      emit({ type: "working" });
      driver.compact();
    } else if (m.type === "stop") {
      if (turn) driver.stop();
    } else if (m.type === "decide") {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      const allow = m.behavior === "allow";
      p.answer(allow, Boolean(allow && m.always));
      emit({ type: "decided", id: m.id, behavior: allow ? "allow" : "deny", always: Boolean(allow && m.always) });
    } else if (m.type === "answer") {
      const p = pending.get(m.id);
      if (!p || p.tool !== "question") return;
      pending.delete(m.id);
      /** @type {Record<string, string[]>} */
      const answers = {};
      for (const [k, v] of Object.entries(m.answers ?? {})) if (Array.isArray(v)) answers[k] = v.map(String);
      p.answer(true, false, answers);
      emit({ type: "answered", id: m.id, answers });
    } else if (m.type === "quit") {
      quit();
    }
  };

  let quitting = false;
  const quit = async () => {
    if (quitting) return;
    quitting = true;
    denyAll("Hey, chat closed.");
    await driver.kill();
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
          if (m.snapshot) {
            const after = Math.max(0, Number(m.after) || 0);
            for (const ev of history.slice(after)) sock.write(`${JSON.stringify(ev)}\n`);
            sock.end(`${JSON.stringify({ type: "replay_end", total: history.length, startedAt })}\n`);
            return;
          }
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
    // startedAt: a pane reads the session file for what came before, and the bridge's replay for the rest.
    writeFileSync(join(state, `${chat}.json`), JSON.stringify({ port, pid: process.pid, cwd, agent, startedAt, protocol: 2 }));
    emit({ type: "ready", session, agent, protocol: 2 });
  });

  setInterval(() => {
    if (panes.size === 0 && !turn && queue.length === 0 && Date.now() - lastSeen > IDLE_MS) quit();
  }, 60 * 1000);
  process.on("SIGTERM", quit);
  process.on("SIGHUP", quit);
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "mcp") mcp(flags(rest));
else if (mode === "serve") serve(flags(rest));
else if (mode === "quit") quitBridge(flags(rest)).catch((e) => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
else if (mode === "find") findBridge(flags(rest)).then(found => process.stdout.write(`${JSON.stringify(found)}\n`)).catch((e) => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
else { process.stderr.write("usage: bridge.mjs serve --chat <id> --cwd <folder> --state <dir> [--agent claude|codex] [--resume <session>] | mcp --port <port>\n"); process.exit(2); }
