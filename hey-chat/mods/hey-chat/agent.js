// Talking to a chat's agent through its bridge (bridge.mjs).
//
// Each real chat has one bridge, a Node program in a hidden Herdr terminal that runs the agent
// and outlives the pane. The pane finds it by the file it writes, <appHome>/data/hey-chat/bridges/
// <chat>.json ({ port, pid }), starts one when there is none, and talks to it over a local socket:
// one JSON object per line each way. A pane that connects gets every event since the bridge
// started, so a reloaded pane rebuilds the chat from them.
import { exec, hc, readTextFile, appHome, window } from "herdr";
import net from "net";

// Use the detected absolute runtime when the core predates a Node.js installation.
let nodeRuntime = "node";

/** The bridges' folder. */
export function bridgeDir() {
  return `${appHome().replace(/\\/g, "/")}/data/hey-chat/bridges`;
}

/** Which agent CLIs are on PATH, in the shell the bridges run in. @returns {Promise<string[]>} */
export async function findAgents() {
  const result = await checkSetup();
  return [...(result.node ? ["node"] : []), ...Object.keys(result.agents).filter(a => result.agents[a].installed)];
}

/** Checks the runtime and each agent's sign-in without starting a conversation. */
export async function checkSetup() {
  const script = `${appHome().replace(/\\/g, "/")}/mods/hey-chat/setup.mjs`;
  try {
    const r = await exec("node", [script], { timeout: 15000 });
    if (r.code === 0) { const result = JSON.parse(r.stdout); nodeRuntime = result.executable || "node"; return result; }
  } catch { /* Node is missing or cannot run. */ }
  return { node: false, agents: {} };
}

/**
 * Bytes to text, line by line. A line ends at byte 10, which never sits inside a UTF-8
 * character, so a chunk that splits a character is held until its line is whole.
 */
class LineReader {
  constructor() { /** @type {number[]} */ this.buf = []; }

  /** @param {Uint8Array} bytes @returns {string[]} the complete lines */
  push(bytes) {
    const out = [];
    for (const b of bytes) {
      if (b === 10) { out.push(utf8(this.buf)); this.buf = []; }
      else this.buf.push(b);
    }
    return out;
  }
}

/** @param {number[]} bytes */
function utf8(bytes) {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(new Uint8Array(bytes));
  let s = "";
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    let cp, n;
    if (b < 0x80) { cp = b; n = 1; }
    else if (b >= 0xf0) { cp = b & 0x07; n = 4; }
    else if (b >= 0xe0) { cp = b & 0x0f; n = 3; }
    else { cp = b & 0x1f; n = 2; }
    for (let k = 1; k < n; k++) cp = (cp << 6) | ((bytes[i + k] ?? 0) & 0x3f);
    s += String.fromCodePoint(cp);
    i += n;
  }
  return s;
}

/** The script that reads sessions (sessions.mjs). */
function sessionsScript() {
  return `${appHome().replace(/\\/g, "/")}/mods/hey-chat/sessions.mjs`;
}

/** Where images a chat shows are copied (images.mjs). */
export function imagesDir() {
  return `${appHome().replace(/\\/g, "/")}/data/hey-chat/images`;
}

/**
 * Saves the clipboard's image for the message box (images.mjs paste), or the image file whose
 * path was pasted. @param {string | null} [file]
 * @returns {Promise<{ path: string, w: number, h: number } | { error: string }>}
 */
export async function pasteImage(file = null) {
  const script = `${appHome().replace(/\\/g, "/")}/mods/hey-chat/images.mjs`;
  const r = await exec("node", [script, "paste", "--dir", imagesDir(), ...(file ? ["--file", file] : [])]).catch((e) => ({ code: 1, stdout: "", stderr: String(e) }));
  try { return JSON.parse(r.stdout); } catch { return { error: (r.stderr || "Couldn't paste the image.").trim() }; }
}

/**
 * Copies a dropped image file in for the message box (images.mjs file).
 * @param {string} file @returns {Promise<{ path: string, w: number, h: number } | { error: string }>}
 */
export async function imageFile(file) {
  const script = `${appHome().replace(/\\/g, "/")}/mods/hey-chat/images.mjs`;
  const r = await exec("node", [script, "file", "--dir", imagesDir(), "--file", file]).catch((e) => ({ code: 1, stdout: "", stderr: String(e) }));
  try { return JSON.parse(r.stdout); } catch { return { error: (r.stderr || "Couldn't add the image.").trim() }; }
}

/**
 * The skills an agent has loaded in a folder (skills.mjs), for the / menu.
 * @param {string} agent @param {string} cwd
 * @returns {Promise<{ name: string, description: string, path?: string }[]>}
 */
export async function listSkills(agent, cwd) {
  const script = `${appHome().replace(/\\/g, "/")}/mods/hey-chat/skills.mjs`;
  const r = await exec("node", [script, "--agent", agent, "--cwd", cwd]).catch(() => null);
  try { return r?.code === 0 ? JSON.parse(r.stdout) : []; } catch { return []; }
}

/** @param {string} agent @param {string} cwd @returns {Promise<{ id: string, name: string }[]>} */
export async function listModels(agent, cwd) {
  const self = `${appHome().replace(/\\/g, "/")}/mods/hey-chat/models.mjs`;
  const r = await exec("node", [self, agent, cwd]);
  if (r.code !== 0) throw new Error(r.stderr.trim() || "Couldn't load models.");
  return JSON.parse(r.stdout);
}

/**
 * Your existing Claude and Codex sessions, newest first (sessions.mjs list).
 * @returns {Promise<{ agent: string, session: string, cwd: string, file: string, title: string, last: string, lastFrom: string, updatedAt: number }[]>}
 */
export async function listSessions() {
  const r = await exec("node", [sessionsScript(), "list"]).catch(() => null);
  try { return r?.code === 0 ? JSON.parse(r.stdout) : []; } catch { return []; }
}

/**
 * A session's history as bridge events (sessions.mjs read): the last `max` messages you typed and
 * what followed, or with `before`, only what came before that time.
 * @param {string} agent @param {string} file @param {number} before @param {number} [max]
 * @returns {Promise<any[]>}
 */
export async function readSession(agent, file, before, max = 40) {
  const r = await exec("node", [sessionsScript(), "read", "--agent", agent, "--file", file, "--before", String(before || 0), "--max", String(max), "--images", imagesDir()]).catch(() => null);
  try { return r?.code === 0 ? JSON.parse(r.stdout) : []; } catch { return []; }
}

/**
 * Removes a session for good (sessions.mjs delete): Claude's file and folder, or `codex delete --force`.
 * @param {string} agent @param {string} session @param {string | null} file
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function deleteSession(agent, session, file) {
  const r = await exec("node", [sessionsScript(), "delete", "--agent", agent, "--session", session, ...(file ? ["--file", file] : [])]).catch((e) => ({ code: 1, stdout: "", stderr: String(e) }));
  try { return JSON.parse(r.stdout); } catch { return { ok: false, message: (r.stderr || "Couldn't delete it.").trim() }; }
}

/** True when a bridge answers on that port. @param {number} port */
async function reachable(port) {
  try { const s = await net.connect("127.0.0.1", port); s.close(); return true; } catch { return false; }
}

/**
 * One chat's link to its bridge.
 * `onEvent(ev, cx)` gets each bridge event. `onClose(cx)` runs when the link drops.
 */
export class Bridge {
  /**
   * @param {{ chat: string, agent: string, cwd: string, session: string | null, model?: string | null }} o
   * @param {(ev: any, cx: any) => void} onEvent @param {(cx: any) => void} onClose
   */
  constructor(o, onEvent, onClose) {
    this.chat = o.chat; this.agent = o.agent; this.cwd = o.cwd; this.session = o.session;
    this.model = o.model ?? null;
    this.onEvent = onEvent; this.onClose = onClose;
    /** @type {import("net").Socket | null} */
    this.sock = null;
    this.closed = false;
    this.startedAt = 0;
    this.protocol = 1;
  }

  /** The port of this chat's running bridge, or null. Sets `startedAt` to when that bridge started. */
  async running() {
    const text = await readTextFile(`${bridgeDir()}/${this.chat}.json`).catch(() => null);
    let port = null;
    try { const s = JSON.parse(text ?? ""); port = Number(s.port) || null; this.startedAt = Number(s.startedAt) || 0; this.protocol = Number(s.protocol) || 1; } catch { /* none */ }
    if (port && await reachable(port)) return port;
    if (!this.session) return null;
    const self = `${appHome().replace(/\\/g, "/")}/mods/hey-chat/bridge.mjs`;
    const r = await exec("node", [self, "find", "--state", bridgeDir(), "--agent", this.agent, "--resume", this.session]);
    const found = r.code === 0 ? JSON.parse(r.stdout) : null;
    if (!found) return null;
    this.startedAt = Number(found.startedAt) || 0;
    this.protocol = Number(found.protocol) || 1;
    return Number(found.port) || null;
  }

  /** Starts the bridge in a hidden terminal and waits for its port. @param {any} cx */
  async launch(cx) {
    const self = `${appHome().replace(/\\/g, "/")}/mods/hey-chat/bridge.mjs`;
    const args = ["serve", "--chat", this.chat, "--agent", this.agent, "--cwd", this.cwd, "--state", bridgeDir(), ...(this.session ? ["--resume", this.session] : []), ...(this.model ? ["--model", this.model] : [])];
    const r = await hc(["run", "--bg", "--no-parent", "--outlive-parent", "--cwd", this.cwd, "--label", "hey-chat=bridge", "--json", "--",
      nodeRuntime, self, ...args]);
    if (r.code !== 0) throw new Error(r.stderr.trim() || "Couldn't start the bridge.");
    for (let i = 0; i < 50; i++) {
      await new Promise((done) => cx.timer.after(100, done));
      const port = await this.running();
      if (port) return port;
    }
    throw new Error("The bridge didn't start. Is node installed?");
  }

  /** Connects and recovers a dropped socket, skipping events already received from the same bridge. @param {any} cx */
  async open(cx) {
    const port = (await this.running()) ?? (await this.launch(cx));
    const startedAt = this.startedAt;
    let received = 0, retries = 0, connected = false;
    while (!this.closed) {
      let sock = null;
      let connectedAt = 0;
      try {
        sock = await net.connect("127.0.0.1", port);
        if (this.closed) { sock.close(); return; }
        this.sock = sock;
        await sock.write(`${JSON.stringify({ role: "pane" })}\n`);
        connected = true;
        connectedAt = Date.now();
        this.onEvent({ type: "connection", state: "connected" }, cx);
        cx.notify();
        const reader = new LineReader();
        let replayed = 0;
        for (;;) {
          const bytes = await sock.read(65536);
          if (!bytes || bytes.length === 0) break;
          for (const line of reader.push(bytes)) {
            let ev = null;
            try { ev = JSON.parse(line); } catch { continue; }
            if (replayed++ < received) continue;
            this.onEvent(ev, cx);
            received++;
            retries = 0;
          }
          cx.notify();
        }
      } catch (e) {
        if (!connected && retries === 0) throw e;
      } finally {
        try { sock?.close(); } catch { /* already closed */ }
        this.sock = null;
      }
      if (this.closed) return;
      if (connectedAt && Date.now() - connectedAt >= 5000) retries = 0;
      this.onEvent({ type: "connection", state: "reconnecting" }, cx);
      cx.notify();
      if (++retries > 3) break;
      await new Promise((done) => cx.timer.after(250 * retries, done));
      if (this.closed) return;
      const running = await this.running().catch(() => null);
      // A replacement bridge has a different replay. Let the pane rebuild from it normally.
      if (running !== port || this.startedAt !== startedAt) break;
    }
    if (!this.closed) {
      this.onEvent({ type: "connection", state: "disconnected" }, cx);
      this.onClose(cx);
    }
  }

  /** @param {any} msg */
  async write(msg) {
    if (!this.sock) throw new Error("Not connected to the bridge.");
    await this.sock.write(`${JSON.stringify(msg)}\n`);
  }

  /**
   * @param {string} text @param {{ path: string, w: number, h: number }[]} [images]
   * @param {{ name: string, path: string } | null} [skill] a Codex skill picked from the / menu
   */
  send(text, images = [], skill = null, id = null) { return this.write({ type: "send", text, images, ...(skill ? { skill } : {}), ...(id ? { id } : {}) }); }
  /** Sends a queued message into the active turn. @param {string} id */
  sendNow(id) { return this.write({ type: "send_now", id }); }
  /** Answers the agent's questions: each question id's answers. @param {string} id @param {Record<string, string[]>} answers */
  answer(id, answers) { return this.write({ type: "answer", id, answers }); }
  /** Has the agent shorten the chat's history. */
  compact() { return this.write({ type: "compact" }); }
  stop() { return this.write({ type: "stop" }); }
  /** @param {string} id @param {"allow" | "deny"} behavior @param {boolean} always */
  decide(id, behavior, always) { return this.write({ type: "decide", id, behavior, always }); }

  /** Ends the bridge (and its agent) for good. */
  async quit() {
    const self = `${appHome().replace(/\\/g, "/")}/mods/hey-chat/bridge.mjs`;
    const r = await exec("node", [self, "quit", "--chat", this.chat, "--state", bridgeDir(), "--agent", this.agent, ...(this.session ? ["--resume", this.session] : [])]);
    if (r.code !== 0) throw new Error(r.stderr.trim() || "Couldn't stop the chat's agent.");
  }

  /** Drops the link. The bridge keeps running for a later pane. */
  close() {
    this.closed = true;
    try { this.sock?.close(); } catch { /* already closed */ }
    this.sock = null;
  }
}
