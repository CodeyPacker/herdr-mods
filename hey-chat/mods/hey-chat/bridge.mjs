#!/usr/bin/env node
// The bridge: runs one chat's agent for Hey, chat and keeps it alive between turns.
//
// A mod's exec stops after 30 s, and a turn can wait on you for longer than that, so the mod
// starts this program in a hidden Herdr terminal and talks to it over a local socket instead.
//
//   node bridge.mjs serve --chat <id> --cwd <folder> --state <dir> [--resume <session>]
//       Listens on 127.0.0.1, writes { port, pid } to <state>/<chat>.json, and runs Claude Code
//       for that chat. Ends on "quit", or after 30 minutes with no pane connected and no turn running.
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
  let session = opts.resume || null;
  /** @type {import("node:child_process").ChildProcess | null} */
  let proc = null;
  let turn = false;         // a turn is running
  let stopping = false;     // the pane asked to stop the turn
  /** @type {any} */
  let killTimer = null;     // ends Claude when SIGINT didn't stop the turn
  let stderr = "";
  /** @type {any[]} */
  const history = [];       // every event so far, for a pane that connects later
  /** @type {Set<import("node:net").Socket>} */
  const panes = new Set();
  /** @type {Map<string, { sock: import("node:net").Socket, tool: string, input: any }>} */
  const pending = new Map();
  /** @type {{ tool: string, prefix?: string }[]} */
  const always = [];        // "Always allow" answers from this run
  let asks = 0;
  let lastSeen = Date.now();

  /** @param {any} ev */
  const emit = (ev) => {
    history.push(ev);
    const line = `${JSON.stringify(ev)}\n`;
    for (const p of panes) p.write(line);
  };

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
      if (turn) {
        turn = false;
        if (stopping) emit({ type: "turn_end", stopped: true });
        else emit({ type: "turn_end", error: true, text: stderr.trim() || `claude stopped (exit ${code}).` });
      }
      stopping = false;
      denyAll("The turn ended.");
    });
  };

  /** @param {any} ev a line of Claude's stream-json */
  const fromClaude = (ev) => {
    if (!ev) return;
    if (ev.session_id && ev.session_id !== session) { session = ev.session_id; emit({ type: "session", id: session }); }
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
      if (!turn) return;
      turn = false;
      // Claude takes SIGINT as "stop this turn", then exits. It's let go here, so the next message
      // starts a new one with --resume instead of racing the old one's exit.
      if (stopping) {
        stopping = false; clearTimeout(killTimer);
        const child = proc; proc = null; child?.kill("SIGTERM");
        emit({ type: "turn_end", stopped: true });
        return;
      }
      const error = Boolean(ev.is_error) || (ev.subtype && ev.subtype !== "success");
      emit({ type: "turn_end", error, text: error ? String(ev.result ?? ev.subtype ?? "The turn failed.") : "" });
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

  /** @param {string} message */
  const denyAll = (message) => {
    for (const [id, p] of pending) { p.sock.end(`${JSON.stringify({ behavior: "deny", message })}\n`); emit({ type: "decided", id, behavior: "deny" }); }
    pending.clear();
  };

  /** @param {import("node:net").Socket} sock @param {any} q */
  const fromMcp = (sock, q) => {
    if (q?.type !== "ask") return;
    if (allowedAlready(q.tool, q.input)) { sock.end(`${JSON.stringify({ behavior: "allow", updatedInput: q.input })}\n`); return; }
    const id = `ask${++asks}`;
    pending.set(id, { sock, tool: q.tool, input: q.input });
    sock.on("close", () => { if (pending.delete(id)) emit({ type: "decided", id, behavior: "deny" }); });
    emit({ type: "permission", id, tool: q.tool, input: q.input, toolUseId: q.toolUseId ?? null });
  };

  /** @param {any} m */
  const fromPane = (m) => {
    if (!m) return;
    if (m.type === "send" && typeof m.text === "string") {
      if (!proc) start();
      turn = true;
      emit({ type: "user", text: m.text, at: Date.now() });
      emit({ type: "working" });
      proc?.stdin?.write(`${JSON.stringify({ type: "user", message: { role: "user", content: m.text } })}\n`);
    } else if (m.type === "stop") {
      // SIGINT first. Only when Claude hasn't ended the turn 5 s later is it ended for good
      // (the next message starts it again with --resume).
      if (proc && turn && !stopping) {
        stopping = true;
        const child = proc;
        child.kill("SIGINT");
        killTimer = setTimeout(() => { if (stopping && proc === child) child.kill("SIGTERM"); }, 5000);
      }
    } else if (m.type === "decide") {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      const allow = m.behavior === "allow";
      if (allow && m.always) {
        const r = ruleFor(p.tool, p.input);
        always.push(r);
        saveRule(r.rule);
      }
      p.sock.end(`${JSON.stringify(allow ? { behavior: "allow", updatedInput: p.input } : { behavior: "deny", message: "The user said no." })}\n`);
      emit({ type: "decided", id: m.id, behavior: allow ? "allow" : "deny", always: Boolean(allow && m.always) });
    } else if (m.type === "quit") {
      quit();
    }
  };

  const quit = () => {
    denyAll("Hey, chat closed.");
    proc?.kill("SIGTERM");
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
      if (role === "pane") fromPane(m); else fromMcp(sock, m);
    }));
    sock.on("close", () => { if (panes.delete(sock)) lastSeen = Date.now(); });
    sock.on("error", () => { /* the close handler tidies up */ });
  });

  server.listen(0, "127.0.0.1", () => {
    mkdirSync(state, { recursive: true });
    const port = /** @type {any} */ (server.address()).port;
    writeFileSync(join(state, `${chat}.json`), JSON.stringify({ port, pid: process.pid, cwd }));
    emit({ type: "ready", session });
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
else { process.stderr.write("usage: bridge.mjs serve --chat <id> --cwd <folder> --state <dir> [--resume <session>] | mcp --port <port>\n"); process.exit(2); }
