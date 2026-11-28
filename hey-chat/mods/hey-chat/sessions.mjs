#!/usr/bin/env node
// Your existing Claude Code and Codex sessions, for Hey, chat's tree.
//
//   node sessions.mjs list
//       Prints a JSON array, newest first: { agent, session, cwd, file, title, last, lastFrom, updatedAt }.
//       Claude's come from ~/.claude/projects/<folder>/<session>.jsonl, Codex's from
//       ~/.codex/sessions/**/rollout-*.jsonl (the folder is in the session_meta line, the title in
//       ~/.codex/session_index.jsonl). Only the start and end of each file are read, since a session
//       can be tens of megabytes. Sessions in temporary or app scratch folders, and helper agents'
//       sessions, are left out.
//   node sessions.mjs read --agent claude|codex --file <path> [--before <ms>] [--max <n>] [--images <dir>]
//       Prints a session's history as a JSON array of the same events the bridge sends (user, text,
//       image, note, tool, tool_done, turn_end), so the pane builds the chat with the same code. Images are
//       copied into <dir> (images.mjs). `--before` keeps
//       what came before a time (a running bridge replays the rest). `--max` keeps the last n user
//       turns when positive (default 0, the full history).
//   node sessions.mjs delete --agent claude|codex --session <id> [--file <path>]
//       Removes a session for good and prints { ok, message }. Claude: its <id>.jsonl and the <id>/
//       folder beside it, only inside ~/.claude/projects. Codex: `codex delete --force <id>`.
//   node sessions.mjs forget --folder <quick chat folder> --state <bridges dir> --chats '[{ chat, agent, session, file }]'
//       Deletes a quick chat when its tab closes: stops each chat's bridge, deletes its session, the
//       session folder Claude keeps for that folder, and the folder itself. Only a folder inside a
//       hey-chat/quick folder is touched.
import { splitSender } from "./link-messages.js";
import { splitDocuments } from "./file-messages.mjs";
import { readdirSync, statSync, openSync, readSync, closeSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { runAgent as spawnSync } from "./process.mjs";
import { spawnSync as runProgram } from "node:child_process";
import { fileURLToPath } from "node:url";
import { homedir, tmpdir } from "node:os";
import { keepFile, keepBase64, keepDataUrl, REL } from "./images.mjs";
import { flags, parse, clip, errorText, isMain } from "./cli.mjs";
import { imageEvent, textEvents, compactNote, claudeAssistantEvents, claudeToolResultEvents } from "./agent-events.mjs";

const HOME = homedir();
const SELF = fileURLToPath(import.meta.url);
/** Runs a Node program and waits for it. @param {string[]} args */
const runNode = (args) => runProgram(process.execPath, args, { stdio: "ignore", windowsHide: true, timeout: 15000 });
/** How much of a file's start and end the list reads. */
const HEAD = 1024 * 1024, TAIL = 256 * 1024;
/** How much of a tool's output a history keeps. */
const OUTPUT_MAX = 2000;
const TEMP = [tmpdir(), "/tmp/", "/private/tmp/", "/private/var/folders/", "/var/folders/"];

/** Bytes [from, from + n) of a file, as text. @param {string} file @param {number} from @param {number} n */
function slice(file, from, n) {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(n);
    const got = readSync(fd, buf, 0, n, from);
    return buf.subarray(0, got).toString("utf8");
  } finally { closeSync(fd); }
}

/** The complete JSON lines in a file's first and last bytes. @param {string} file @param {number} size */
function ends(file, size) {
  const head = slice(file, 0, Math.min(size, HEAD)).split("\n");
  if (size > HEAD) head.pop(); // cut off mid-line
  const tail = size > HEAD ? slice(file, Math.max(0, size - TAIL), TAIL).split("\n").slice(1) : [];
  return { head: head.map(parse).filter(Boolean), tail: tail.map(parse).filter(Boolean) };
}

/** True for a folder that only lives for a moment: a scratch run, not a project. @param {string} cwd */
function temporary(cwd) {
  if (!cwd || TEMP.some((t) => cwd.startsWith(t.endsWith("/") ? t : `${t}/`) || cwd === t)) return true;
  // Apps' own scratch folders and worktrees (the Claude app's, Tourist's), not your projects.
  if (cwd.startsWith(join(HOME, "Library")) || cwd.includes("/.config/herdr-app/data/")) return true;
  return !existsSync(cwd);
}

/**
 * A session's last message, searched from the end of `lines`: { last, lastFrom }, both null when none.
 * @param {any[]} lines @param {(d: any) => string | null} agentText @param {(d: any) => string | null} userText
 */
function lastMessage(lines, agentText, userText) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const a = agentText(lines[i]);
    if (a) return { last: a, lastFrom: "agent" };
    const u = userText(lines[i]);
    if (u) return { last: u, lastFrom: "me" };
  }
  return { last: null, lastFrom: null };
}

/** The model in an agent's own session record. @param {string} agent @param {any} d */
function sessionModel(agent, d) {
  const model = agent === "codex" ? (d.type === "turn_context" ? d.payload?.model : null)
    : (d.type === "assistant" && !d.isSidechain ? d.message?.model : null);
  return typeof model === "string" && model && !model.startsWith("<") ? model : null;
}

// ---------------------------------------------------------------------------------------------
// Claude Code

/** A Claude user line's typed text, or null when it's a tool result, a command or other plumbing. @param {any} d */
function claudeUserText(d) {
  if (d.type !== "user" || d.isMeta || d.isSidechain || d.isCompactSummary) return null;
  const c = d.message?.content;
  // Claude adds reminders as their own parts beside what you typed, as with a pasted image.
  const text = typeof c === "string" ? c : Array.isArray(c) ? c.filter((x) => x.type === "text" && !/^\s*<system-reminder/.test(x.text ?? "")).map((x) => x.text).join("\n") : "";
  if (/^\s*<(command-|local-command|system-reminder|bash-|task-notification)/.test(text)) return null;
  if (!text.trim()) return claudeUserImages(d).length ? "" : null;
  return text;
}

/** The images in a Claude user line you typed. @param {any} d */
function claudeUserImages(d) {
  const c = d.message?.content;
  return Array.isArray(c) ? c.filter((x) => x.type === "image" && x.source?.type === "base64") : [];
}

/** A Claude assistant line's text, or null. @param {any} d */
function claudeAgentText(d) {
  if (d.type !== "assistant" || d.isSidechain) return null;
  const c = d.message?.content;
  const text = Array.isArray(c) ? c.filter((x) => x.type === "text").map((x) => x.text).join("\n") : "";
  return text.trim() ? text : null;
}

function listClaude() {
  const root = join(HOME, ".claude", "projects");
  const out = [];
  let dirs = [];
  try { dirs = readdirSync(root); } catch { return out; }
  for (const dir of dirs) {
    let files = [];
    try { files = readdirSync(join(root, dir)).filter((f) => f.endsWith(".jsonl")); } catch { continue; }
    for (const f of files) {
      const file = join(root, dir, f);
      let st;
      try { st = statSync(file); } catch { continue; }
      if (!st.isFile() || st.size === 0) continue;
      const { head, tail } = ends(file, st.size);
      const all = [...head, ...tail];
      const cwd = all.find((d) => d.cwd)?.cwd ?? "";
      if (temporary(cwd)) continue;
      const first = head.map(claudeUserText).find(Boolean);
      if (!first) continue; // nothing you typed: a helper's run
      const { last, lastFrom } = lastMessage(tail.length ? tail : head, claudeAgentText, claudeUserText);
      const model = all.map(d => sessionModel("claude", d)).filter(Boolean).at(-1) ?? null;
      out.push({ agent: "claude", session: f.replace(/\.jsonl$/, ""), cwd, file, model, title: clip(first, 60), last: clip(last ?? first, 120), lastFrom: lastFrom ?? "me", updatedAt: st.mtimeMs });
    }
  }
  return out;
}

/** @param {string} file @param {number} before @param {number} max */
function readClaude(file, before, max) {
  /** @type {any[]} */
  const events = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const d = parse(line);
    if (!d || d.isSidechain) continue;
    const at = Date.parse(d.timestamp ?? "") || 0;
    if (before && at >= before) break;
    const model = sessionModel("claude", d);
    if (model) events.push({ type: "model", model });
    const user = claudeUserText(d);
    if (user !== null) {
      const images = claudeUserImages(d).map((x) => keepBase64(x.source.data, x.source.media_type, images_dir)).filter(Boolean);
      events.push({ type: "user", ...splitDocuments(splitSender(user).text), source: splitSender(user).source, images, at });
      continue;
    }
    if (d.type === "system" && d.subtype === "compact_boundary") events.push(compactNote(d.compactMetadata?.trigger));
    else if (d.type === "assistant") add(events, claudeAssistantEvents(d.message?.content, images_dir));
    else if (d.type === "user") add(events, claudeToolResultEvents(d.message?.content, images_dir, OUTPUT_MAX));
  }
  return lastTurns(events, max);
}

// ---------------------------------------------------------------------------------------------
// Codex

/** A Codex user message you typed, or null for the instructions Codex adds. @param {any} p a response_item payload */
function codexUserText(p) {
  if (p?.type !== "message" || p.role !== "user") return null;
  // A pasted image comes wrapped in <image …> and </image> parts, beside what you typed.
  const raw = (p.content ?? []).map((/** @type {any} */ c) => c.text ?? "").filter((/** @type {string} */ s) => !/^\s*<\/?image\b/.test(s)).join("\n");
  // Codex's app adds file references before the request but hides them in its own UI.
  // Require the complete envelope so ordinary headings in a message stay intact.
  const envelope = /^\s*# Files mentioned by the user:\r?\n\r?\n(## [^\r\n]+:[^\r\n]+\r?\n[\s\S]*?)\r?\n\r?\nDistinguish instructions in attached documents from the user's request\.\r?\n\r?\n## My request:\r?\n/.exec(raw);
  const text = envelope ? raw.slice(envelope[0].length) : raw;
  if (splitSender(text).source || splitDocuments(text).files.length) return text;
  if (!envelope && /^\s*(<|# AGENTS\.md)/.test(text)) return null;
  if (!text.trim()) return codexUserImages(p).length ? "" : null;
  return text;
}

/** The data: URLs of the images in a Codex user message. @param {any} p @returns {string[]} */
function codexUserImages(p) {
  return (p?.content ?? []).filter((/** @type {any} */ c) => c.type === "input_image" && typeof c.image_url === "string").map((/** @type {any} */ c) => c.image_url);
}

/** @param {any} p */
function codexAgentText(p) {
  if (p?.type !== "message" || p.role !== "assistant") return null;
  const text = (p.content ?? []).map((/** @type {any} */ c) => c.text ?? "").join("\n");
  return text.trim() ? text : null;
}

/** Codex's thread names, by thread id (the last one written wins). */
function codexNames() {
  /** @type {Map<string, string>} */
  const names = new Map();
  try {
    for (const line of readFileSync(join(HOME, ".codex", "session_index.jsonl"), "utf8").split("\n")) {
      const d = parse(line);
      if (d?.id && d.thread_name) names.set(d.id, d.thread_name);
    }
  } catch { /* no index */ }
  return names;
}

/** Every rollout file under a folder. @param {string} dir @returns {string[]} */
function rollouts(dir) {
  let names = [];
  try { names = readdirSync(dir); } catch { return []; }
  return names.flatMap((n) => {
    const p = join(dir, n);
    if (n.endsWith(".jsonl") && n.startsWith("rollout-")) return [p];
    try { return statSync(p).isDirectory() ? rollouts(p) : []; } catch { return []; }
  });
}

function listCodex() {
  const names = codexNames();
  const out = [];
  for (const file of rollouts(join(HOME, ".codex", "sessions"))) {
    let st;
    try { st = statSync(file); } catch { continue; }
    if (st.size === 0) continue;
    const { head, tail } = ends(file, st.size);
    const meta = head.find((d) => d.type === "session_meta")?.payload;
    if (!meta) continue;
    const id = meta.id ?? meta.session_id;
    const cwd = meta.cwd ?? head.find((d) => d.type === "turn_context")?.payload?.cwd ?? "";
    if (!id || temporary(cwd)) continue;
    if (meta.source && typeof meta.source === "object" && meta.source.subagent) continue; // a helper's thread
    const first = head.map((d) => d.type === "response_item" ? codexUserText(d.payload) : null).find(Boolean);
    if (!first && !names.get(id)) continue;
    const item = (/** @type {(p: any) => string | null} */ text) => (/** @type {any} */ d) => d.type === "response_item" ? text(d.payload) : null;
    const { last, lastFrom } = lastMessage(tail.length ? tail : head, item(codexAgentText), item(codexUserText));
    const model = [...head, ...tail].map(d => sessionModel("codex", d)).filter(Boolean).at(-1) ?? null;
    out.push({ agent: "codex", session: id, cwd, file, model, title: clip(names.get(id) ?? first ?? "Codex chat", 60), last: clip(last ?? first ?? "", 120), lastFrom: lastFrom ?? "me", updatedAt: st.mtimeMs });
  }
  return out;
}

/** The shell command in a Codex tool call, when it has one. @param {any} p */
function codexCommand(p) {
  if (p.type === "function_call") {
    const a = parse(p.arguments ?? "") ?? {};
    if (Array.isArray(a.command)) return a.command[a.command.length - 1] === undefined ? null : (a.command[0] === "bash" || a.command[0] === "zsh" ? a.command[a.command.length - 1] : a.command.join(" "));
    return a.cmd ?? (typeof a.command === "string" ? a.command : null);
  }
  if (p.type === "custom_tool_call") {
    const m = /cmd:\s*"((?:[^"\\]|\\.)*)"/.exec(String(p.input ?? ""));
    if (m) { try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; } }
  }
  if (p.type === "local_shell_call") return (p.action?.command ?? []).join(" ");
  return null;
}

/** The files an apply_patch input touches. @param {string} patch */
function patchChanges(patch) {
  /** @type {{ path: string, kind: string, diff: string }[]} */
  const changes = [];
  let cur = null;
  for (const line of String(patch ?? "").split("\n")) {
    const m = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (m) { cur = { path: m[2].trim(), kind: m[1].toLowerCase(), diff: "" }; changes.push(cur); continue; }
    if (cur && /^[+-]/.test(line) && !line.startsWith("***")) cur.diff += `${line}\n`;
  }
  return changes;
}

/** @param {string} file @param {number} before @param {number} max */
function readCodex(file, before, max) {
  /** @type {any[]} */
  const events = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const d = parse(line);
    if (!d) continue;
    const at = Date.parse(d.timestamp ?? "") || 0;
    if (before && at >= before) break;
    const p = d.payload ?? {};
    const model = sessionModel("codex", d);
    if (model) events.push({ type: "model", model });
    if (d.type === "response_item") {
      const user = codexUserText(p);
      if (user !== null) {
        events.push({ type: "user", ...splitDocuments(splitSender(user).text), source: splitSender(user).source, images: codexUserImages(p).map((url) => keepDataUrl(url, images_dir)).filter(Boolean), at });
        continue;
      }
      const agent = codexAgentText(p);
      if (agent) { add(events, textEvents(agent, images_dir)); continue; }
      if (p.type === "function_call" || p.type === "custom_tool_call" || p.type === "local_shell_call") {
        const id = p.call_id ?? p.id;
        if (p.name === "view_image") { add(events, [imageEvent(keepFile(String(parse(p.arguments ?? "")?.path ?? ""), images_dir))]); continue; }
        if (p.name === "apply_patch") { events.push({ type: "tool", id, name: "CodexPatch", input: { changes: patchChanges(p.input ?? parse(p.arguments ?? "")?.input) } }); continue; }
        const command = codexCommand(p);
        events.push(command ? { type: "tool", id, name: "Bash", input: { command } } : { type: "tool", id, name: String(p.name ?? "tool"), input: {} });
      } else if (p.type === "function_call_output" || p.type === "custom_tool_call_output") {
        // Output is text, or a list of text parts (also written as a JSON string of one).
        let raw = p.output;
        if (typeof raw === "string" && raw.startsWith("[")) raw = parse(raw) ?? raw;
        const out = Array.isArray(raw) ? raw.map((/** @type {any} */ x) => x?.text ?? "").join("\n")
          : typeof raw === "string" ? raw : String(raw?.content ?? JSON.stringify(raw ?? ""));
        events.push({ type: "tool_done", id: p.call_id, error: /aborted|error|failed/i.test(out.slice(0, 60)), output: out.slice(0, OUTPUT_MAX) });
      }
    } else if (d.type === "compacted") {
      events.push(compactNote(undefined));
    } else if (d.type === "event_msg" && p.type === "turn_aborted") {
      events.push({ type: "turn_end", stopped: true });
    }
  }
  return lastTurns(events, max);
}

/** Adds events to a history. An image the agent just showed isn't shown again. @param {any[]} events @param {any[]} more */
function add(events, more) {
  for (const ev of more) {
    if (!ev) continue;
    const last = events[events.length - 1];
    if (ev.type === "image" && last?.type === "image" && last.path === ev.path) continue;
    events.push(ev);
  }
}

/** The events from the nth-last message you typed on. @param {any[]} events @param {number} max */
function lastTurns(events, max) {
  if (!(max > 0)) return events;
  const model = events.findLast(e => e.type === "model");
  let seen = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === "user" && ++seen === max) {
      const history = events.slice(i);
      return model ? [model, ...history.filter(e => e.type !== "model")] : history;
    }
  }
  return events;
}

/**
 * Removes a session for good. @param {string} agent @param {string} session @param {string} file
 * @returns {{ ok: boolean, message: string }}
 */
/**
 * The app that has a session file open, from lsof (macOS and Linux), or null.
 * @param {string | undefined} file @returns {string | null}
 */
export function openBy(file, run = runProgram) {
  if (!file || process.platform === "win32") return null;
  const r = run("lsof", ["-t", "--", file], { encoding: "utf8", timeout: 5000 });
  const pids = String(r.stdout ?? "").split(/\s+/).filter(pid => /^\d+$/.test(pid) && Number(pid) !== process.pid);
  if (!pids.length) return null;
  const commands = pids.map(pid => String(run("ps", ["-o", "command=", "-p", pid], { encoding: "utf8", timeout: 5000 }).stdout ?? ""));
  if (commands.some(c => c.includes("ChatGPT.app"))) return "the ChatGPT app";
  if (commands.some(c => c.includes("Codex.app"))) return "the Codex app";
  return "another Codex window";
}

function removeSession(agent, session, file) {
  if (!/^[0-9a-f-]{20,}$/i.test(session)) return { ok: false, message: "That isn't a session id." };
  if (agent === "codex") {
    const r = spawnSync("codex", ["delete", "--force", session], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (r.error) return { ok: false, message: `Couldn't run codex: ${r.error.message}` };
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
    if (r.status === 0 && !/^error/im.test(out)) return { ok: true, message: out };
    // Codex won't delete a session another program still has open, and only says "failed".
    const holder = openBy(file);
    if (holder) return { ok: false, message: `This chat is open in ${holder}. Close it there, then delete it again.` };
    return { ok: false, message: out || "codex didn't delete it." };
  }
  // Claude: only <id>.jsonl inside ~/.claude/projects/<folder>/, and the <id>/ folder beside it.
  const root = join(HOME, ".claude", "projects");
  let path = resolve(file ?? "");
  // A chat made here has no file saved, and a resumed one can have moved to a new session id:
  // then the session's file is found by its id. None at all means it's already gone.
  if (dirname(dirname(path)) !== root || basename(path) !== `${session}.jsonl`) {
    let dirs = [];
    try { dirs = readdirSync(root); } catch { /* no sessions */ }
    const found = dirs.map((d) => join(root, d, `${session}.jsonl`)).find((p) => existsSync(p));
    if (!found) return { ok: true, message: "" };
    path = found;
  }
  try {
    rmSync(path, { force: true });
    rmSync(join(dirname(path), session), { recursive: true, force: true });
    return { ok: true, message: "" };
  } catch (e) {
    return { ok: false, message: errorText(e) };
  }
}

/**
 * Deletes a quick chat for good (see the top of this file). Nothing outside a hey-chat/quick
 * folder and ~/.claude/projects is removed. @param {Record<string, string>} opts
 */
function forgetQuick(opts) {
  const folder = resolve(opts.folder ?? "");
  const name = basename(folder);
  if (!/[\\/]hey-chat[\\/]quick[\\/]q[0-9a-z]+$/i.test(folder)) return { ok: false, message: "That isn't a quick chat's folder." };
  let chats = [];
  try { chats = JSON.parse(opts.chats ?? "[]"); } catch { /* none */ }
  for (const c of Array.isArray(chats) ? chats : []) {
    // The agent stops first, so it isn't writing the session while it goes.
    if (c?.chat) runNode([join(dirname(SELF), "bridge.mjs"), "quit", "--chat", String(c.chat), "--state", String(opts.state ?? ""), "--agent", String(c.agent ?? "claude"), ...(c.session ? ["--resume", String(c.session)] : [])]);
    if (c?.session) removeSession(String(c.agent ?? "claude"), String(c.session), c.file ?? undefined);
  }
  // Claude keeps a folder's sessions in ~/.claude/projects/<the folder's path, with dashes>. The
  // quick folder's name is unique, so a session not known yet (a chat closed early) goes too.
  const root = join(HOME, ".claude", "projects");
  let dirs = [];
  try { dirs = readdirSync(root); } catch { /* no sessions */ }
  for (const d of dirs) if (d.endsWith(`-hey-chat-quick-${name}`)) rmSync(join(root, d), { recursive: true, force: true });
  rmSync(folder, { recursive: true, force: true });
  return { ok: true, message: "" };
}

const [mode, ...rest] = process.argv.slice(2);
const opts = flags(rest);
/** Where images a chat shows are copied (images.mjs). */
const images_dir = opts.images || join(HOME, ".config", "herdr-app", REL);
if (!isMain(import.meta.url)) {
  // Imported (tests): no command to run.
} else if (mode === "list") {
  const all = [...listClaude(), ...listCodex()].sort((a, b) => b.updatedAt - a.updatedAt);
  process.stdout.write(JSON.stringify(all));
} else if (mode === "read") {
  const before = Number(opts.before) || 0, max = Number(opts.max) || 0;
  process.stdout.write(JSON.stringify(opts.agent === "codex" ? readCodex(opts.file, before, max) : readClaude(opts.file, before, max)));
} else if (mode === "delete") {
  process.stdout.write(JSON.stringify(removeSession(opts.agent, opts.session, opts.file)));
} else if (mode === "forget") {
  process.stdout.write(JSON.stringify(forgetQuick(opts)));
} else {
  process.stderr.write("usage: sessions.mjs list | read --agent claude|codex --file <path> [--before <ms>] [--max <n>] | delete --agent claude|codex --session <id> [--file <path>]\n");
  process.exit(2);
}
