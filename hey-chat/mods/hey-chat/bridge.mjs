#!/usr/bin/env node
// The bridge: runs one chat's agent for Hey, chat and keeps it alive between turns.
//
// A mod's exec stops after 30 s, and a turn can wait on you for longer than that, so the mod
// starts this program in a hidden Herdr terminal and talks to it over a local socket instead.
//
//   node bridge.mjs serve --chat <id> --cwd <folder> --state <dir> [--agent claude|codex] [--resume <session>]
//       [--permissions ask|edits|auto|full]
//       Listens on 127.0.0.1, writes { port, pid, token } to <state>/<chat>.json, and runs the chat's agent:
//       Claude Code (`claude -p`, the default) or Codex (`codex app-server`). Ends on "quit", or after
//       30 minutes with no pane connected and no turn running.
//   node bridge.mjs mcp --port <port> --state <dir> --chat <id>
//       Claude starts this itself as a stdio MCP server with two tools. `approve`, which Claude asks
//       (--permission-prompt-tool) whenever your settings don't already allow a tool, passes the
//       question to the serving bridge and waits for your answer from the pane. `plan` (always
//       allowed) only acknowledges: the pane draws its steps from the tool call.
//
// The socket carries one JSON object per line. The first line says who is talking and carries the
// token from the bridge's file. Only you can read that file, so nothing else on the computer
// (another account, a web page posting to the port) can send messages or answer for you:
//   { role: "pane" }  the mod. It sends { type: "send", text, images, skill?, permissions? }, { type: "stop" },
//                     { type: "permissions", level },
//                     { type: "answer", id, answers: { <question id>: [answer, …] } } for the agent's questions,
//                     { type: "decide", id, behavior: "allow" | "deny", always }, { type: "quit" },
//                     and gets every event since the bridge started (then { type: "replay_end" }
//                     when its first line has replayEnd: true), then each new one:
//                     ready, session, user, working, text, image, note, tool, tool_done,
//                     permission, question, decided, answered, turn_end, error.
//   { role: "mcp" }   the approve tool. It sends { type: "ask", tool, input } and gets one
//                     { behavior, ... } line back: the answer Claude expects.
import { spawnAgent as spawn } from "./process.mjs";
import { createServer, connect } from "node:net";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chatMcpServer, codexMcpArgs, LINK_TOOL_NAMES, permissionLevel, claudePermissionMode, codexPermissions } from "./bridge-options.js";
import { withSender } from "./link-messages.js";
import { ChatLinks, CHAT_TOOLS, CHAT_INSTRUCTIONS } from "./chat-links.mjs";
import { readDocuments } from "./documents.mjs";
import { withDocuments } from "./file-messages.mjs";
import { keepFile, fileOf, mediaType } from "./images.mjs";
import { flags, parse, lines, errorText, isMain } from "./cli.mjs";
import { imageEvent, textEvents, compactNote, claudeAssistantEvents, claudeToolResultEvents } from "./agent-events.mjs";

const SELF = fileURLToPath(import.meta.url);
const IDLE_MS = 30 * 60 * 1000;
/**
 * How long a chat's agent stays running with no turn. After that it is stopped to free its memory,
 * and the next message starts it again on the same session.
 */
const AGENT_IDLE_MS = 30 * 60 * 1000;
/** How much of a tool's output goes to the pane. */
const OUTPUT_MAX = 4000;
/** What "Always allow" means for Codex, shown on its permission cards. */
const CODEX_COVERS = "Always allow lasts for the rest of this session.";
/** Shell syntax that can run a second command, or write a file, inside one command line. */
const SHELL_SYNTAX = /[;&|<>`$(){}\n\r]/;
/** Bash commands whose "Always allow" rule covers the first two words (`git push`), not just the first. */
const TWO_WORD = new Set(["git", "gh", "npm", "pnpm", "yarn", "bun", "cargo", "go", "docker", "kubectl", "brew", "pip", "uv", "make", "node"]);

/** A question's options as the pane shows them. @param {any} x a question from Claude or Codex */
function optionsOf(x) {
  return (x.options ?? []).map((/** @type {any} */ o) => ({ label: String(o.label ?? ""), description: String(o.description ?? "") }));
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

/** The first line a client sends: who it is, and the bridge's token. @param {string} role @param {any} saved a bridge's file */
function hello(role, saved) {
  return `${JSON.stringify({ role, ...(saved?.token ? { token: saved.token } : {}) })}\n`;
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
      sock.on("connect", () => sock.write(hello("pane", saved)));
      sock.on("data", lines(line => {
        const ev = parse(line);
        if ((ev?.type === "ready" && ev.session === opts.resume) || (ev?.type === "session" && ev.id === opts.resume)) finish({ ...saved, file: join(opts.state, file) });
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
    sock.on("connect", () => sock.write(`${hello("pane", saved)}${JSON.stringify({ type: "quit" })}\n`));
    sock.on("data", () => {}); // Drain the bridge's replay while waiting for shutdown.
    sock.on("end", () => { clearTimeout(timer); resolve(); });
    sock.on("error", (e) => {
      clearTimeout(timer);
      // Windows resets the connection when the bridge exits, where other systems end it.
      const gone = e.code === "ECONNREFUSED" || (process.platform === "win32" && e.code === "ECONNRESET");
      if (gone) resolve(); else reject(e);
    });
  });
}

// ---------------------------------------------------------------------------------------------
// mcp: the approve tool, and the plan tool the pane shows as a checklist

const PLAN_TOOL = {
  name: "plan",
  description: "Shows your plan to the person in Hey, chat as a live checklist above their message box. "
    + "For a task with 3 or more steps, call it before you start with every step, then again with the whole list each time a step starts or finishes. "
    + "Keep one step in_progress while you work. Each call replaces the list.",
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: { text: { type: "string", description: "The step, in a few plain words." }, status: { type: "string", enum: ["pending", "in_progress", "completed"] } },
          required: ["text", "status"],
        },
      },
    },
    required: ["items"],
  },
};

/** What Claude is told about the plan tool, at the end of its system prompt. */
const PLAN_PROMPT = "You are running inside Hey, chat. For any task with 3 or more steps, keep the person's checklist current with the mcp__heychat__plan tool "
  + "(load it with ToolSearch if it is deferred): call it with every step before you start, and again with the whole list whenever a step starts or finishes.";

function mcp(opts) {
  const port = Number(opts.port);
  /** The serving bridge's file, for its token. */
  const saved = () => { try { return JSON.parse(readFileSync(join(opts.state, `${opts.chat}.json`), "utf8")); } catch { return null; } };
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
      }, PLAN_TOOL, ...(opts.links === "true" ? CHAT_TOOLS : [])].filter(tool => opts.agent !== "codex" || tool.name !== "approve") } });
    } else if (m.method === "tools/call" && m.params?.name === "plan") {
      // The pane reads the steps from the tool call itself, so there is nothing to do here.
      reply({ id: m.id, result: { content: [{ type: "text", text: "The person sees this plan. Call plan again with the whole list when a step starts or finishes." }] } });
    } else if (m.method === "tools/call") {
      const args = m.params?.arguments ?? {};
      if (m.params?.name !== "approve") {
        try {
          const result = await askBridge(port, saved(), { type: "link_tool", name: m.params?.name, arguments: args });
          reply({ id: m.id, result: { content: [{ type: "text", text: JSON.stringify(result) }], ...(result.error ? { isError: true } : {}) } });
        } catch (error) { reply({ id: m.id, result: { isError: true, content: [{ type: "text", text: errorText(error) }] } }); }
        return;
      }
      const answer = await askBridge(port, saved(), { type: "ask", tool: args.tool_name, input: args.input ?? {}, toolUseId: args.tool_use_id ?? null })
        .catch(() => ({ behavior: "deny", message: "Hey, chat couldn't ask you, so this was not allowed." }));
      reply({ id: m.id, result: { content: [{ type: "text", text: JSON.stringify(answer) }] } });
    } else if (m.method === "ping") {
      reply({ id: m.id, result: {} });
    } else if (m.id !== undefined) {
      reply({ id: m.id, error: { code: -32601, message: `Unknown method ${m.method}` } });
    }
  }));
}

/** Sends one question to the serving bridge and waits for its one-line answer. @param {number} port @param {any} saved the bridge's file @param {any} question */
function askBridge(port, saved, question) {
  return new Promise((resolve, reject) => {
    const sock = connect(port, "127.0.0.1");
    sock.on("connect", () => { sock.write(`${hello("mcp", saved)}${JSON.stringify(question)}\n`); });
    sock.on("data", lines((line) => { const a = parse(line); if (a) { resolve(a); sock.end(); } }));
    sock.on("error", reject);
    sock.on("close", () => reject(new Error("closed")));
  });
}

// ---------------------------------------------------------------------------------------------
// serve: one chat

/** Runs one chat's agent and listens for its pane. @param {Record<string, string>} opts see the top of this file */
export function serve(opts, dependencies = {}) {
  const timers = [];
  const spawnProcess = dependencies.spawnAgent ?? spawn;
  const outputStatus = dependencies.outputStatus ?? (value => process.stdout.write(value));
  const chat = opts.chat, cwd = opts.cwd, state = opts.state;
  const agent = opts.agent === "codex" ? "codex" : "claude";
  const links = opts.links === "true" ? new ChatLinks({ state, chat, cwd, agent, model: opts.model || null, title: opts.title || "", session: opts.resume || null, permissions: () => permissions, launch: dependencies.launchBridge, models: dependencies.listModels }) : null;
  const savedLink = links?.get();
  let session = opts.resume || savedLink?.session || null;
  const selectedModel = opts.model || null;
  /** How often the agent asks first (bridge-options.js). The pane sends changes. */
  let permissions = permissionLevel(opts.permissions);
  let activeMessage = null;
  let failedMessage = null;
  let turn = false;         // a turn is running
  let turnEndedAt = Date.now(); // when the agent last had work
  const deliveredIds = new Set(links?.events.filter(e => ["user", "link_notice"].includes(e.type)).map(e => e.queueId).filter(Boolean) ?? []);
  const queue = (savedLink?.queue ?? []).filter(entry => !deliveredIds.has(entry.id)).map(entry => ({ ...entry, steering: false, interrupting: false }));
  links?.saveQueue(queue);
  const submitted = new Set([...(links?.events.filter(e => ["queued", "user", "link_notice"].includes(e.type)).map(e => e.queueId ?? e.id).filter(Boolean) ?? []), ...queue.map(entry => entry.id)]);
  if (links) for (const event of links.events) {
    if (event.type === "turn_end" && event.retry) failedMessage = { id: event.retry.id, entry: { ...event.retry, id: `original-${event.retry.id}` } };
    if (event.type === "retry_cleared" && failedMessage?.id === event.id) failedMessage = null;
  }
  let messageId = 0;
  /** @type {any[]} */
  const history = [...(links?.events ?? [])];       // every event so far, for a pane that connects later
  /** @type {Set<import("node:net").Socket>} */
  const panes = new Set();
  const clients = new Set();
  /**
   * Questions waiting on you, by id. `answer` replies to whoever asked: the approve tool's
   * socket for Claude, the app-server's request for Codex.
   * @type {Map<string, { tool: string, input: any, async?: boolean, answer: (allow: boolean, always: boolean, answers?: Record<string, string[]>) => void }>}
   */
  const pending = new Map();
  let asks = 0;
  let lastSeen = Date.now();
  const startedAt = savedLink?.createdAt ?? Date.now();
  /** What a client must send first. It is kept in this bridge's file, which only you can read. */
  const token = randomBytes(24).toString("hex");

  /** @param {any} ev */
  const emit = (ev) => {
    if (links) {
      ev = links.record(ev);
      const attention = [...pending].map(([id, p]) => ({ id, kind: p.tool === "question" ? "question" : "permission", tool: p.tool }));
      const status = attention.length ? "blocked" : turn ? "working" : ev.type === "turn_end" ? ev.error ? "error" : ev.stopped ? "idle" : "done" : links.get().status ?? "idle";
      links.update({ id: chat, attention, status });
      outputStatus(`\x1b]7501;state=${status}:app=hey-chat\x1b\\`);
      if (ev.type === "text") links.update({ id: chat, lastResponse: String(ev.text ?? "").slice(-2000) });
      if (["permission", "question", "turn_end"].includes(ev.type) && !ev.recovered) {
        links.enqueue(() => links.notifyParent(ev, status)).catch(error => {
          links.update({ id: chat, reportError: errorText(error) });
        });
      }
    }
    history.push(ev);
    const line = `${JSON.stringify(ev)}\n`;
    for (const p of panes) p.write(line);
  };

  // Images: the ones you send are already in the images folder. The ones the agent shows (an image
  // it reads or views, or a full path to one in its words) are copied there for the pane.
  const imageDir = join(dirname(state), "images");
  /** @param {{ path: string, w: number, h: number } | null} img */
  const showImage = (img) => { const ev = imageEvent(img); if (ev) emit(ev); };
  /** The agent's words, then each image file they name. @param {string} text */
  const emitText = (text) => { for (const ev of textEvents(text, imageDir)) emit(ev); };

  /** @param {string | null} id */
  const setSession = (id) => { if (id && id !== session) { session = id; emit({ type: "session", id }); } };
  let model = null;
  /** The actual model reported by the agent, rather than a configured default. @param {any} value */
  const setModel = (value) => {
    if (typeof value === "string" && value && !value.startsWith("<") && value !== model) {
      model = value; emit({ type: "model", model });
    }
  };

  /**
   * Puts a question to the pane. `covers` says in words what "Always allow" would allow.
   * @param {string} tool @param {any} input @param {string | null} toolUseId @param {string} covers @param {(allow: boolean, always: boolean) => void} answer
   */
  const ask = (tool, input, toolUseId, covers, answer) => {
    const id = `ask${++asks}`;
    pending.set(id, { tool, input, answer });
    emit({ type: "permission", id, tool, input, toolUseId, covers });
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
    turnEndedAt = Date.now();
    denyAll("The turn ended.", !error && !stopped);
    let retry = null;
    if (error && activeMessage) {
      failedMessage = { id: `failure-${randomBytes(12).toString("hex")}`, entry: activeMessage };
      const { text, images, files, skill } = activeMessage;
      retry = { id: failedMessage.id, text, images, files, skill };
    }
    activeMessage = null;
    emit(stopped ? { type: "turn_end", stopped: true } : { type: "turn_end", error, text, ...(retry ? { retry } : {}) });
    if (links) emit({ type: "linked_summary", summary: links.summary(chat) });
    if (queue[0]?.interrupting) { queue[0].interrupting = false; drainQueue(); }
    else if (!error && !stopped) drainQueue();
  };

  /** The agent could not start or went away. Ends the turn it was in, so later messages are not queued behind it. @param {string} message */
  const failed = (message) => { if (turn) endTurn(true, message); else emit({ type: "error", message }); };

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
      const mcpConfig = { mcpServers: { heychat: chatMcpServer({ node: process.execPath, script: SELF, port, state, chat, provider: "claude", linked: Boolean(links) }) } };
      const args = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
        "--permission-prompt-tool", "mcp__heychat__approve", "--mcp-config", JSON.stringify(mcpConfig),
        "--allowedTools", "mcp__heychat__plan", ...(links ? LINK_TOOL_NAMES.map(name => `mcp__heychat__${name}`) : []),
        "--append-system-prompt", [PLAN_PROMPT, ...(links ? [CHAT_INSTRUCTIONS] : [])].join("\n\n"),
        // Allows switching to Full access later. The mode itself comes from --permission-mode.
        "--permission-mode", claudePermissionMode(permissions), "--allow-dangerously-skip-permissions",
        ...(session ? ["--resume", session] : []), ...(selectedModel ? ["--model", selectedModel] : [])];
      stderr = "";
      const child = spawnProcess("claude", args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
      proc = child;
      child.stdout.on("data", lines((line) => fromClaude(parse(line))));
      child.stderr.on("data", (d) => { stderr = (stderr + d.toString()).slice(-2000); });
      // Writing to a Claude that is gone must not end the bridge. Its exit reports the failure.
      child.stdin?.on("error", () => {});
      // Claude never started (not installed, no such folder). No exit follows, so the turn ends here.
      child.on("error", (e) => {
        if (proc !== child) return;
        proc = null; stopping = false;
        failed(`Couldn't start claude: ${e.message}`);
      });
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
        for (const e of claudeAssistantEvents(ev.message?.content, imageDir)) emit(e);
      } else if (ev.type === "user") {
        for (const e of claudeToolResultEvents(ev.message?.content, imageDir, OUTPUT_MAX)) emit(e);
      } else if (ev.type === "system" && ev.subtype === "compact_boundary") {
        emit(compactNote(ev.compact_metadata?.trigger));
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

    /**
     * True when an "Always allow" answer from this run covers the call. A Bash rule covers its own
     * words and their arguments. A command line that chains, pipes, redirects or substitutes
     * another command (`git status && curl … | sh`) is asked about instead.
     * @param {string} tool @param {any} input
     */
    const allowedAlready = (tool, input) => always.some((r) => {
      if (r.tool !== tool) return false;
      if (!r.prefix) return true;
      const command = String(input?.command ?? "").trim();
      if (SHELL_SYNTAX.test(command)) return false;
      return command === r.prefix || command.startsWith(`${r.prefix} `);
    });

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

    let controlId = 0;
    return {
      /** Changes a running Claude's permission mode. A new Claude starts with the current one. */
      setPermissions() {
        proc?.stdin?.write(`${JSON.stringify({ type: "control_request", request_id: `mode-${++controlId}`, request: { subtype: "set_permission_mode", mode: claudePermissionMode(permissions) } })}\n`);
      },
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
      /** True while a Claude runs that the next message could start again from its session. */
      idle() { return Boolean(proc && session); },
      /** Stops an idle Claude. It is let go first, so its exit isn't taken for a failed turn. */
      release() { const child = proc; proc = null; return terminate(child); },
      /** The approve tool's question. @param {import("node:net").Socket} sock @param {any} q */
      approve(sock, q) {
        if (q?.type !== "ask") return;
        const reply = (/** @type {any} */ a) => sock.end(`${JSON.stringify(a)}\n`);
        if (links && LINK_TOOL_NAMES.some(name => q.tool === `mcp__heychat__${name}`)) {
          reply({ behavior: "allow", updatedInput: q.input });
          return;
        }
        // AskUserQuestion: Claude's questions for you. Your answers go back in its input, keyed by
        // question text, several picks joined with ", " (as Claude Code's own picker answers).
        if (q.tool === "AskUserQuestion") {
          const qs = Array.isArray(q.input?.questions) ? q.input.questions : [];
          const id = askQuestions(qs.map((/** @type {any} */ x) => ({ id: String(x.question ?? ""), header: String(x.header ?? ""), question: String(x.question ?? ""),
            options: optionsOf(x), multi: Boolean(x.multiSelect) })),
          (answers) => reply(answers
            ? { behavior: "allow", updatedInput: { ...q.input, answers: Object.fromEntries(qs.map((/** @type {any} */ x) => [x.question, (answers[x.question] ?? []).join(", ")])) } }
            : { behavior: "deny", message: "The user dismissed the question without answering." }));
          sock.on("close", () => withdraw(id));
          return;
        }
        if (allowedAlready(q.tool, q.input)) { reply({ behavior: "allow", updatedInput: q.input }); return; }
        const rule = ruleFor(q.tool, q.input);
        const covers = rule.prefix
          ? `Always allow covers every command that starts with "${rule.prefix}", in this folder.`
          : `Always allow covers every use of ${q.tool} in this folder.`;
        const id = ask(q.tool, q.input, q.toolUseId ?? null, covers, (allow, alwaysToo) => {
          if (allow && alwaysToo) { always.push(rule); saveRule(rule.rule); }
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
    /** Settles once a Codex stopped for being idle has let go of the session. @type {Promise<void>} */
    let released = Promise.resolve();
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
      const port = server.address().port;
      const linkConfig = links ? codexMcpArgs(chatMcpServer({ node: process.execPath, script: SELF, port, state, chat, provider: "codex" })) : [];
      const child = spawnProcess("codex", ["app-server", ...linkConfig], { cwd, stdio: ["pipe", "pipe", "pipe"] });
      proc = child;
      child.stdout.on("data", lines((line) => fromCodex(parse(line))));
      child.stderr.on("data", (d) => { stderr = (stderr + d.toString()).slice(-2000); });
      child.stdin?.on("error", () => {});
      /** Codex is gone: what waits on it fails. False when the bridge had already let it go. @param {string} message */
      const gone = (message) => {
        if (proc !== child) return false;
        proc = null; ready = null; turnId = null;
        for (const c of calls.values()) c.reject(new Error(message));
        calls.clear();
        return true;
      };
      // Codex never started (not installed, no such folder). No exit follows, so the turn ends here.
      child.on("error", (e) => { const message = `Couldn't start codex: ${e.message}`; if (gone(message)) failed(message); });
      child.on("exit", (code) => { const message = stderr.trim() || `codex stopped (exit ${code}).`; if (gone(message)) endTurn(true, message); });
      ready = (async () => {
        // The Codex before this one may still hold the session.
        await released;
        await call("initialize", { clientInfo: { name: "hey-chat", title: "Hey, chat", version: "1" }, capabilities: { experimentalApi: true } });
        write({ method: "initialized", params: {} });
        const options = { cwd, ...(selectedModel ? { model: selectedModel } : {}), ...(links ? {
          developerInstructions: CHAT_INSTRUCTIONS,
        } : {}) };
        const r = session ? await call("thread/resume", { threadId: session, ...options }) : await call("thread/start", options);
        setSession(r?.thread?.id ?? null);
        setModel(r?.model);
      })();
      // Whoever sends awaits this and reports its failure.
      ready.catch(() => {});
    };

    /** The words for a file change: its paths, and its diffs as + and - lines. @param {any} item */
    const patchInput = (item) => ({ changes: (item?.changes ?? []).map((/** @type {any} */ c) => ({ path: c.path, kind: c.kind?.type ?? "update", diff: String(c.diff ?? "") })) });

    /**
     * Answers an approval request. `v1` is the older execCommandApproval / applyPatchApproval protocol.
     * @param {any} id the request's id @param {boolean} v1 @param {boolean} allow @param {boolean} always
     */
    const decide = (id, v1, allow, always) => write({ id, result: { decision: v1
      ? (allow ? (always ? "approved_for_session" : "approved") : "denied")
      : (allow ? (always ? "acceptForSession" : "accept") : "decline") } });

    /**
     * A turn's input: the skill picked from the / menu (its /name comes off the text), the images, then the text.
     * @param {string} text @param {{ path: string }[]} images @param {{ name: string, path: string } | null} skill
     */
    const turnInput = (text, images, skill) => {
      const words = skill ? text.replace(/^\/\S+\s*/, "") : text;
      return [
        ...(skill ? [{ type: "skill", name: skill.name, path: skill.path }] : []),
        ...images.map((img) => ({ type: "localImage", path: fileOf(img.path, imageDir) })),
        ...(words ? [{ type: "text", text: words, text_elements: [] }] : []),
      ];
    };

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
          ask("Bash", { command, description: p.reason ?? undefined }, p.itemId ?? p.callId ?? null, CODEX_COVERS, (allow, always) => decide(m.id, v1, allow, always));
        } else if (m.method === "item/fileChange/requestApproval" || m.method === "applyPatchApproval") {
          const v1 = m.method === "applyPatchApproval";
          const input = v1 ? { changes: Object.entries(p.fileChanges ?? {}).map(([path, c]) => ({ path, kind: "update", diff: String(/** @type {any} */ (c)?.unified_diff ?? "") })) } : patchInput(items.get(p.itemId));
          ask("CodexPatch", input, p.itemId ?? p.callId ?? null, CODEX_COVERS, (allow, always) => decide(m.id, v1, allow, always));
        } else if (m.method === "item/tool/requestUserInput") {
          // Codex's questions for you. Answers go back by question id; dismissed ones get none.
          const qs = Array.isArray(p.questions) ? p.questions : [];
          const id = askQuestions(qs.map((/** @type {any} */ x) => ({ id: String(x.id), header: String(x.header ?? ""), question: String(x.question ?? ""),
            options: optionsOf(x), multi: false, secret: Boolean(x.isSecret) })),
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
                call(active ? "turn/steer" : "turn/start", { threadId: session, input, ...(active ? { expectedTurnId: turnId } : { ...codexPermissions(permissions), ...(selectedModel ? { model: selectedModel } : {}) }) })
                  .then(r => { turnId = r?.turn?.id ?? turnId; })
                  .catch(e => endTurn(true, errorText(e)));
              }, true);
            }
          }
          else if (it.type === "contextCompaction") emit(compactNote(undefined));
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
      /** Codex takes the level with each turn/start, so a change applies from the next turn. */
      setPermissions() {},
      send(text, images, skill = null) {
        if (!proc) start();
        const input = turnInput(text, images, skill);
        startingTurn = (async () => {
          try {
            await ready;
            const r = await call("turn/start", { threadId: session, input, ...codexPermissions(permissions), ...(selectedModel ? { model: selectedModel } : {}) });
            turnId = r?.turn?.id ?? turnId;
          } catch (e) {
            endTurn(true, errorText(e));
          }
        })();
      },
      /** Adds input to the live turn without interrupting its tools. */
      async steer(text, images, skill) {
        await ready;
        await startingTurn;
        if (!turnId) throw new Error("The active turn has ended.");
        await call("turn/steer", { threadId: session, expectedTurnId: turnId, input: turnInput(text, images, skill) });
      },
      stop() {
        if (proc && session && turnId) call("turn/interrupt", { threadId: session, turnId }).catch(() => endTurn(false, "", true));
      },
      kill() { return terminate(proc); },
      /** True while a Codex runs that the next message could start again from its session. */
      idle() { return Boolean(proc && session); },
      /** Stops an idle Codex. It is let go first, so its exit isn't taken for a failed turn. */
      release() {
        const child = proc;
        proc = null; ready = null; turnId = null;
        released = terminate(child);
        return released;
      },
      /** Codex has no approve tool. @param {import("node:net").Socket} sock */
      approve(sock) { sock.end(`${JSON.stringify({ behavior: "deny", message: "Not used by Codex." })}\n`); },
    };
  }

  // -------------------------------------------------------------------------------------------
  // The pane's messages, and the socket.

  const deliver = (entry) => {
    queue.splice(queue.indexOf(entry), 1);
    activeMessage = entry;
    emit({ type: "user", queueId: entry.id, text: entry.text, images: entry.images, files: entry.files, skill: entry.skill, source: entry.source, at: entry.at });
    links?.saveQueue(queue);
  };
  const documentInput = entry => withSender(withDocuments(entry.text, readDocuments(entry.files ?? [], join(dirname(state), "files"))), entry.source);
  // Routine reports belong in the pane, not in the model's conversation. Human approval
  // requests remain visible in the child; errors, blockers and explicit needs can wake the parent.
  const routineUpdate = entry => entry.source?.kind === "update" && entry.source.status !== "error"
    && !entry.source.blockers?.length && !entry.source.needs?.length;
  const showNotice = entry => emit({ type: "link_notice", queueId: entry.id, text: entry.text, source: entry.source, at: entry.at });
  const startMessage = (entry, preparedText) => {
    // Also handle routine reports queued by an older bridge before it stopped.
    if (routineUpdate(entry)) {
      queue.splice(queue.indexOf(entry), 1);
      showNotice(entry);
      links?.saveQueue(queue);
      drainQueue();
      return;
    }
    let text;
    try { text = preparedText ?? documentInput(entry); }
    catch (error) {
      emit({ type: "queued", ...entry });
      emit({ type: "queue_error", id: entry.id, message: errorText(error) });
      return;
    }
    if (failedMessage) {
      emit({ type: "retry_cleared", id: failedMessage.id });
      failedMessage = null;
    }
    turn = true;
    deliver(entry);
    emit({ type: "working" });
    driver.send(text, entry.images, entry.skill);
  };
  const drainQueue = () => {
    if (!turn && queue.length && !queue[0].steering) startMessage(queue[0]);
  };
  const sendNow = async (entry) => {
    if (!entry || entry.steering || entry.interrupting) return;
    if (!turn) { startMessage(entry); return; }
    if (agent === "claude") {
      try { documentInput(entry); }
      catch (error) { emit({ type: "queue_error", id: entry.id, message: errorText(error) }); return; }
      // Claude's streaming CLI has no turn/steer RPC. Resume with the selected message after interrupting.
      queue.splice(queue.indexOf(entry), 1); queue.unshift(entry);
      links?.saveQueue(queue);
      entry.interrupting = true;
      driver.stop();
      return;
    }
    entry.steering = true;
    try {
      await driver.steer(documentInput(entry), entry.images, entry.skill);
      deliver(entry);
    } catch (e) {
      entry.steering = false;
      emit({ type: "queue_error", id: entry.id, message: errorText(e) });
    }
    if (!turn) drainQueue();
  };

  /** @param {any} m */
  const fromPane = (m) => {
    if (!m || quitting) return;
    if (m.type === "send" && typeof m.text === "string") {
      // The pane's current level rides along, for a bridge that missed a change while unconnected.
      if (m.permissions) fromPane({ type: "permissions", level: m.permissions });
      // Pictures you pasted: { path, w, h } each, already in the images folder.
      const images = (Array.isArray(m.images) ? m.images : []).filter((/** @type {any} */ i) => typeof i?.path === "string");
      const skill = m.skill && typeof m.skill.name === "string" && typeof m.skill.path === "string" ? m.skill : null;
      const files = (Array.isArray(m.files) ? m.files : []).filter(f => f?.kind === "document" && typeof f.path === "string");
      if (!m.text && images.length === 0 && files.length === 0) return;
      const id = typeof m.id === "string" ? m.id : `message-${++messageId}`;
      if (submitted.has(id)) return;
      submitted.add(id);
      const entry = { id, text: m.text, images, files, skill, ...(m.source ? { source: m.source } : {}), at: Date.now(), steering: false, interrupting: false };
      if (routineUpdate(entry)) { showNotice(entry); return; }
      queue.push(entry);
      links?.saveQueue(queue);
      if (turn || queue.length > 1) emit({ type: "queued", ...entry });
      if (m.now) void sendNow(entry); else drainQueue();
    } else if (m.type === "retry_turn") {
      if (!failedMessage || failedMessage.id !== m.id) {
        emit({ type: "retry_error", id: m.id, message: "This turn has already been retried or a newer message has started." });
        return;
      }
      if (turn) {
        emit({ type: "retry_error", id: m.id, message: "Wait for the current turn to finish, then try again." });
        return;
      }
      const entry = { ...failedMessage.entry, id: `retry-${failedMessage.id}`, at: Date.now(), steering: false, interrupting: false };
      let text;
      try {
        text = documentInput(entry);
        for (const image of entry.images) {
          try { readFileSync(fileOf(image.path, imageDir)); }
          catch { throw new Error("An attached image is missing. Restore it before retrying, or send a new message."); }
        }
      }
      catch (error) { emit({ type: "retry_error", id: m.id, message: errorText(error) }); return; }
      queue.unshift(entry);
      submitted.add(entry.id);
      startMessage(entry, text);
    } else if (m.type === "send_now") {
      void sendNow(queue.find(entry => entry.id === m.id));
    } else if (m.type === "queue_edit" || m.type === "queue_remove") {
      const entry = queue.find(entry => entry.id === m.id);
      if (!entry || entry.steering || entry.interrupting) {
        emit({ type: "queue_error", id: m.id, message: "This message has already started sending. It can't be changed." });
        return;
      }
      if (m.type === "queue_remove") {
        queue.splice(queue.indexOf(entry), 1);
        links?.saveQueue(queue);
        emit({ type: "queue_removed", id: entry.id });
      } else {
        if (typeof m.text !== "string" || (!m.text.trim() && !entry.images.length && !entry.files.length)) {
          emit({ type: "queue_error", id: entry.id, message: "Add a message or use Remove." });
          return;
        }
        entry.text = m.text.trim();
        entry.skill = m.skill && typeof m.skill.name === "string" && typeof m.skill.path === "string" ? m.skill : null;
        links?.saveQueue(queue);
        emit({ type: "queue_updated", id: entry.id, text: entry.text });
      }
    } else if (m.type === "permissions") {
      const level = permissionLevel(m.level);
      if (level !== permissions) { permissions = level; driver.setPermissions(); }
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
    } else if (m.type === "link_seen" && links) {
      if (!turn && !pending.size && links.get().status === "done") {
        links.update({ id: chat, status: "idle" });
        outputStatus("\x1b]7501;state=idle:app=hey-chat\x1b\\");
      }
    } else if (m.type === "link_metadata" && links) {
      if (typeof m.title === "string") links.update({ id: chat, title: m.title.slice(0, 120) });
    } else if (m.type === "quit") {
      quit();
    }
  };

  const runLinkedTool = async (name, args) => {
    if (!links) throw new Error("Linked chats are not enabled in this bridge. Reopen the chat after its current work finishes.");
    const result = await links.enqueue(() => links.call(name, args));
    if (name === "chat_create") emit({ type: "linked_chat", chat: links.get(result.chat_id) });
    if (name === "chat_summary") {
      emit({ type: "linked_summary", summary: links.summary(chat) });
      if (args.needs?.length) links.enqueue(() => links.notifyParent(links.events.at(-1), "decision requested")).catch(() => {});
    }
    return result;
  };

  const control = async m => {
    if (!links) throw new Error("This bridge does not support linked chats.");
    if (m.type === "link_ping") return { chat, session, status: links.get().status, protocol: 12 };
    if (m.type === "link_tool") return runLinkedTool(m.name, m.arguments ?? {});
    if (m.type === "link_send") {
      links.related(m.source?.chat);
      if (typeof m.id !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(m.id) || typeof m.text !== "string") throw new Error("Invalid linked message.");
      fromPane({ ...m, type: "send" });
      return { accepted: true, message_id: m.id, queued: queue.some(entry => entry.id === m.id) };
    }
    if (m.type === "link_metadata") {
      const fields = {};
      if (typeof m.title === "string") fields.title = m.title.slice(0, 120);
      links.update({ id: chat, ...fields });
      return { updated: true };
    }
    throw new Error("Unknown linked-chat request.");
  };

  let quitting = false;
  const quit = async () => {
    if (quitting) return;
    quitting = true;
    links?.stop();
    denyAll("Hey, chat closed.");
    await driver.kill();
    try { rmSync(join(state, `${chat}.json`)); } catch { /* already gone */ }
    for (const timer of timers) clearInterval(timer);
    for (const client of clients) client.destroy?.();
    server.close?.();
    if (dependencies.exit) dependencies.exit(0); else process.exit(0);
  };

  const server = createServer((sock) => {
    clients.add(sock);
    /** @type {string | null} */
    let role = null;
    sock.on("data", lines((line) => {
      const m = parse(line);
      if (role === null) {
        // A first line without the token is not ours: another account, or a web page.
        if (!m || m.token !== token) { role = "refused"; sock.destroy(); return; }
        role = m.role === "mcp" ? "mcp" : m.role === "control" ? "control" : "pane";
        if (role === "pane") {
          if (m.snapshot) {
            const after = Math.max(0, Number(m.after) || 0);
            for (const ev of history.slice(after)) sock.write(`${JSON.stringify(ev)}\n`);
            sock.end(`${JSON.stringify({ type: "replay_end", total: history.length, startedAt })}\n`);
            return;
          }
          panes.add(sock); lastSeen = Date.now();
          for (const ev of history) sock.write(`${JSON.stringify(ev)}\n`);
          // A pane that asks is told where the replay ends. It isn't an event, so it isn't kept in history.
          if (m.replayEnd) sock.write(`${JSON.stringify({ type: "replay_end" })}\n`);
        }
        return;
      }
      if (role === "pane") fromPane(m);
      else if (role === "control" || (role === "mcp" && m.type === "link_tool")) {
        control(m).then(result => sock.end(`${JSON.stringify(role === "mcp" ? result : { result })}\n`), error => sock.end(`${JSON.stringify({ error: errorText(error) })}\n`));
      } else if (role === "mcp") driver.approve(sock, m);
    }));
    sock.on("close", () => { clients.delete(sock); if (panes.delete(sock)) lastSeen = Date.now(); });
    sock.on("error", () => { /* the close handler tidies up */ });
  });

  server.on?.("error", error => {
    for (const timer of timers) clearInterval(timer);
    if (links) links.update({ id: chat, status: "error", bridgeError: errorText(error) });
    if (!dependencies.exit) { process.stderr.write(`Could not start the chat bridge: ${errorText(error)}\n`); process.exit(1); }
  });
  server.listen(0, "127.0.0.1", () => {
    mkdirSync(state, { recursive: true });
    const port = /** @type {any} */ (server.address()).port;
    // startedAt: a pane reads the session file for what came before, and the bridge's replay for the rest.
    // Made new each time and readable by you alone, since it holds the token.
    const file = join(state, `${chat}.json`);
    rmSync(file, { force: true });
    writeFileSync(file, JSON.stringify({ port, pid: process.pid, cwd, agent, startedAt, protocol: 12, token }), { mode: 0o600 });
    emit({ type: "ready", session, agent, protocol: 12 });
    if (links && ["working", "blocked"].includes(savedLink?.status)) {
      const request = savedLink.lastRequest;
      if (request) { activeMessage = { ...request, id: request.queueId ?? request.id, images: request.images ?? [], files: request.files ?? [] }; turn = true; endTurn(true, "This turn was interrupted when its bridge stopped. You can retry the original request."); }
    }
    if (links) for (const entry of queue) emit({ type: "queued", ...entry });
  });

  if (links) { const timer = setInterval(() => { void links.flushReports(); }, 2000); timer.unref?.(); timers.push(timer); }

  timers.push(setInterval(() => {
    if (panes.size === 0 && !turn && queue.length === 0 && Date.now() - lastSeen > IDLE_MS) { quit(); return; }
    // A pane is still open, but the agent has had nothing to do: stop it and keep the bridge. A
    // question still waiting on you keeps it, since its answer goes to that same agent.
    const resting = !turn && queue.length === 0 && pending.size === 0 && Date.now() - turnEndedAt > AGENT_IDLE_MS;
    if (resting && !quitting && driver.idle()) driver.release();
  }, 60 * 1000));
  if (!dependencies.exit) { process.on("SIGTERM", quit); process.on("SIGHUP", quit); }
  return { server, close: quit };
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const failed = (/** @type {Error} */ e) => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; };
  if (mode === "mcp") mcp(flags(rest));
  else if (mode === "serve") serve(flags(rest));
  else if (mode === "quit") quitBridge(flags(rest)).catch(failed);
  else if (mode === "find") findBridge(flags(rest)).then(found => process.stdout.write(`${JSON.stringify(found)}\n`)).catch(failed);
  else { process.stderr.write("usage: bridge.mjs serve --chat <id> --cwd <folder> --state <dir> [--agent claude|codex] [--resume <session>] | mcp --port <port> --state <dir> --chat <id>\n"); process.exit(2); }
}
