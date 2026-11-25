// Talking to a chat's agent through its bridge (bridge.mjs).
//
// Each real chat has one bridge, a Node program in a hidden Herdr terminal that runs the agent
// and outlives the pane. The pane finds it by the file it writes, <appHome>/data/hey-chat/bridges/
// <chat>.json ({ port, pid, token }), starts one when there is none, and talks to it over a local
// socket: one JSON object per line each way, the first carrying the token. A pane that connects
// gets every event since the bridge started, so a reloaded pane rebuilds the chat from them.
import { exec, hc, readTextFile } from "herdr";
import net from "net";
import { dataDir, script } from "./common.js";

// Use the detected absolute runtime when the core predates a Node.js installation.
let nodeRuntime = "node";

/** How long after the last event or message a bridge is checked every few seconds for events the socket missed. */
const ACTIVE_MS = 2 * 60 * 1000;
/** A quiet bridge is checked on every nth tick instead. */
const QUIET_EVERY = 10;
/**
 * A bridge from before `replay_end` doesn't say when its replay is done. It counts as done once
 * nothing has arrived for this long, and at the latest SYNC_MAX_MS after connecting.
 */
const SYNC_QUIET_MS = 500, SYNC_MAX_MS = 5000;

/** The bridges' folder. */
function bridgeDir() {
  return `${dataDir()}/bridges`;
}

/**
 * Runs one of the mod's Node programs. Resolves with its exit code, its JSON output (null when
 * there is none) and its trimmed stderr. A program that can't start counts as exit 1.
 * @param {string} name @param {string[]} args
 * @returns {Promise<{ code: number, out: any, stderr: string }>}
 */
async function runScript(name, args) {
  const r = await exec("node", [script(name), ...args]).catch((e) => ({ code: 1, stdout: "", stderr: String(e) }));
  let out = null;
  try { out = JSON.parse(r.stdout); } catch { /* no JSON */ }
  return { code: r.code, out, stderr: String(r.stderr ?? "").trim() };
}

/** Checks the runtime and each agent's sign-in without starting a conversation. */
export async function checkSetup() {
  try {
    const r = await exec("node", [script("setup.mjs")], { timeout: 15000 });
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

/** Where images a chat shows are copied (images.mjs). */
function imagesDir() {
  return `${dataDir()}/images`;
}

/**
 * Saves the clipboard's image for the message box (images.mjs paste), or the image file whose
 * path was pasted. @param {string | null} [file]
 * @returns {Promise<{ path: string, w: number, h: number } | { error: string }>}
 */
export async function pasteImage(file = null) {
  const r = await runScript("images.mjs", ["paste", "--dir", imagesDir(), ...(file ? ["--file", file] : [])]);
  return r.out ?? { error: r.stderr || "Couldn't paste the image." };
}

/**
 * Copies a dropped image file in for the message box (images.mjs file).
 * @param {string} file @returns {Promise<{ path: string, w: number, h: number } | { error: string }>}
 */
export async function imageFile(file) {
  const r = await runScript("images.mjs", ["file", "--dir", imagesDir(), "--file", file]);
  return r.out ?? { error: r.stderr || "Couldn't add the image." };
}

/**
 * The skills an agent has loaded in a folder (skills.mjs), for the / menu.
 * @param {string} agent @param {string} cwd
 * @returns {Promise<{ name: string, description: string, path?: string }[]>}
 */
export async function listSkills(agent, cwd) {
  const r = await runScript("skills.mjs", ["--agent", agent, "--cwd", cwd]);
  return r.code === 0 && r.out ? r.out : [];
}

/** @param {string} agent @param {string} cwd @returns {Promise<{ id: string, name: string }[]>} */
export async function listModels(agent, cwd) {
  const r = await exec("node", [script("models.mjs"), agent, cwd]);
  if (r.code !== 0) throw new Error(r.stderr.trim() || "Couldn't load models.");
  return JSON.parse(r.stdout);
}

/**
 * Your existing Claude and Codex sessions, newest first (sessions.mjs list).
 * @returns {Promise<{ agent: string, session: string, cwd: string, file: string, title: string, last: string, lastFrom: string, updatedAt: number }[]>}
 */
export async function listSessions() {
  const r = await runScript("sessions.mjs", ["list"]);
  return r.code === 0 && r.out ? r.out : [];
}

/**
 * A session's history as bridge events (sessions.mjs read): the last `max` messages you typed and
 * what followed, or with `before`, only what came before that time.
 * @param {string} agent @param {string} file @param {number} before @param {number} [max]
 * @returns {Promise<any[]>}
 */
export async function readSession(agent, file, before, max = 40) {
  const r = await runScript("sessions.mjs", ["read", "--agent", agent, "--file", file, "--before", String(before || 0), "--max", String(max), "--images", imagesDir()]);
  return r.code === 0 && r.out ? r.out : [];
}

/**
 * Removes a session for good (sessions.mjs delete): Claude's file and folder, or `codex delete --force`.
 * @param {string} agent @param {string} session @param {string | null} file
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function deleteSession(agent, session, file) {
  const r = await runScript("sessions.mjs", ["delete", "--agent", agent, "--session", session, ...(file ? ["--file", file] : [])]);
  return r.out ?? { ok: false, message: r.stderr || "Couldn't delete it." };
}

/**
 * Deletes a quick chat for good: stops each chat's bridge, deletes its session, then removes the
 * chat's folder (only one inside the quick chats folder). Runs as one Node program, so it finishes
 * even after the pane is gone. @param {any[]} chats @param {string} folder
 */
export function forgetQuick(chats, folder) {
  const list = chats.map((c) => ({ chat: c.id, agent: c.agent, session: c.session ?? null, file: c.file ?? null }));
  return exec("node", [script("sessions.mjs"), "forget", "--folder", folder, "--state", bridgeDir(), "--chats", JSON.stringify(list)]);
}

/** True when a bridge answers on that port. @param {number} port */
async function reachable(port) {
  try { const s = await net.connect("127.0.0.1", port); s.close(); return true; } catch { return false; }
}

/**
 * One chat's link to its bridge.
 * `onEvent(ev, cx)` gets each bridge event, and `{ type: "synced" }` once the bridge has replayed
 * what came before. `onClose(cx)` runs when the link drops.
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
    /** @type {number | null} */
    this.port = null;
    this.startedAt = 0;
    this.protocol = 1;
    /** The bridge's file and the token in it, which the bridge asks for first. @type {string | null} */
    this.file = null;
    /** @type {string | null} */
    this.token = null;
    this.received = 0;
    this.lastEventAt = 0;
    this.lastWriteAt = 0;
    this.quietTicks = 0;
    this.catchUpBusy = false;
    this.watch = null;
    /** The first connection's replay has been passed on. */
    this.synced = false;
    this.connectedAt = 0;
    /** Counts the quiet checks, so a check knows whether a read came after it was armed. */
    this.reads = 0;
  }

  /** Says the replay is done, once. @param {any} cx */
  markSynced(cx) {
    if (this.synced) return;
    this.synced = true;
    this.onEvent({ type: "synced" }, cx);
    cx.notify();
  }

  /** For a bridge that doesn't send `replay_end`: marks the replay done once reads go quiet. @param {any} cx */
  waitForQuiet(cx) {
    if (this.synced) return;
    const read = ++this.reads;
    cx.timer.after(SYNC_QUIET_MS, (/** @type {any} */ cx) => {
      if (this.reads === read || Date.now() - this.connectedAt >= SYNC_MAX_MS) this.markSynced(cx);
    });
  }

  /**
   * True when this tick should look for missed events. A bridge that had an event or a message in
   * the last two minutes is checked on every tick. A quiet one is checked on every tenth, since
   * each check starts a Node program.
   */
  dueForCatchUp() {
    if (Date.now() - Math.max(this.lastEventAt, this.lastWriteAt) < ACTIVE_MS) { this.quietTicks = 0; return true; }
    return this.quietTicks++ % QUIET_EVERY === 0;
  }

  /** Recover events even if the native socket's pending read never settles. */
  async catchUp(cx) {
    if (this.closed || !this.sock || this.catchUpBusy || Date.now() - this.lastEventAt < 5000) return;
    this.catchUpBusy = true;
    const sock = this.sock, startedAt = this.startedAt, after = this.received;
    try {
      // The bridge's file goes first when known: the helper reads the token from it.
      const result = await exec("node", [script("bridge-events.mjs"), ...(this.file ? [this.file] : []), String(this.port), String(after)], { timeout: 5000 });
      if (result.code !== 0 || this.closed || this.sock !== sock || this.startedAt !== startedAt) return;
      const replay = JSON.parse(result.stdout);
      if (replay.startedAt && replay.startedAt !== startedAt) return;
      for (let i = 0; i < replay.events.length; i++) {
        if (after + i < this.received) continue;
        this.onEvent(replay.events[i], cx);
        this.received++;
        this.lastEventAt = Date.now();
      }
      cx.notify();
    } finally { this.catchUpBusy = false; }
  }

  /** Takes a bridge's facts from its file's contents. Returns its port, or null. @param {any} saved @param {string} file */
  adopt(saved, file) {
    this.startedAt = Number(saved.startedAt) || 0;
    this.protocol = Number(saved.protocol) || 1;
    this.token = typeof saved.token === "string" ? saved.token : null;
    this.file = file;
    return Number(saved.port) || null;
  }

  /**
   * The port of this chat's running bridge, or null. Sets `startedAt` to when that bridge started.
   * With `search`, a bridge that runs the same session under another chat id is found too.
   * @param {boolean} [search]
   */
  async running(search = true) {
    const file = `${bridgeDir()}/${this.chat}.json`;
    const text = await readTextFile(file).catch(() => null);
    let port = null;
    try { port = this.adopt(JSON.parse(text ?? ""), file); } catch { /* none */ }
    if (port && await reachable(port)) return port;
    if (!search || !this.session) return null;
    const r = await exec("node", [script("bridge.mjs"), "find", "--state", bridgeDir(), "--agent", this.agent, "--resume", this.session]);
    const found = r.code === 0 ? JSON.parse(r.stdout) : null;
    if (!found) return null;
    return this.adopt(found, typeof found.file === "string" ? found.file.replace(/\\/g, "/") : null);
  }

  /** Starts the bridge in a hidden terminal and waits for its port. @param {any} cx */
  async launch(cx) {
    const args = ["serve", "--chat", this.chat, "--agent", this.agent, "--cwd", this.cwd, "--state", bridgeDir(), ...(this.session ? ["--resume", this.session] : []), ...(this.model ? ["--model", this.model] : [])];
    const r = await hc(["run", "--bg", "--no-parent", "--outlive-parent", "--cwd", this.cwd, "--label", "hey-chat=bridge", "--json", "--",
      nodeRuntime, script("bridge.mjs"), ...args]);
    if (r.code !== 0) throw new Error(r.stderr.trim() || "Couldn't start the bridge.");
    for (let i = 0; i < 50; i++) {
      await new Promise((done) => cx.timer.after(100, done));
      // The new bridge writes this chat's own file, so there is no other to search for.
      const port = await this.running(false);
      if (port) return port;
    }
    throw new Error("The bridge didn't start. Is node installed?");
  }

  /** Connects and recovers a dropped socket, skipping events already received from the same bridge. @param {any} cx */
  async open(cx) {
    const port = (await this.running()) ?? (await this.launch(cx));
    this.port = port;
    const startedAt = this.startedAt;
    this.received = 0;
    let retries = 0, connected = false;
    this.watch = cx.timer.every(3000, (cx) => {
      if (!this.dueForCatchUp()) return;
      cx.spawn(async (cx) => {
        try { await this.catchUp(cx); } catch (error) { console.error("Chat replay check failed:", error); }
      });
    });
    while (!this.closed) {
      let sock = null;
      let connectedAt = 0;
      try {
        sock = await net.connect("127.0.0.1", port);
        if (this.closed) { sock.close(); return; }
        this.sock = sock;
        // replayEnd: the bridge marks where its replay ends with { type: "replay_end" }.
        await sock.write(`${JSON.stringify({ role: "pane", replayEnd: true, ...(this.token ? { token: this.token } : {}) })}\n`);
        connected = true;
        connectedAt = Date.now();
        this.connectedAt ||= connectedAt;
        this.onEvent({ type: "connection", state: "connected" }, cx);
        cx.notify();
        this.waitForQuiet(cx);
        const reader = new LineReader();
        let replayed = 0;
        for (;;) {
          const bytes = await sock.read(65536);
          if (!bytes || bytes.length === 0) break;
          for (const line of reader.push(bytes)) {
            let ev = null;
            try { ev = JSON.parse(line); } catch { continue; }
            // The marker isn't an event: it doesn't count toward what was received.
            if (ev.type === "replay_end") { this.markSynced(cx); continue; }
            if (replayed++ < this.received) continue;
            this.onEvent(ev, cx);
            this.received++;
            this.lastEventAt = Date.now();
            retries = 0;
          }
          this.waitForQuiet(cx);
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
      this.watch?.cancel();
      this.onEvent({ type: "connection", state: "disconnected" }, cx);
      this.onClose(cx);
    }
  }

  /** @param {any} msg */
  async write(msg) {
    if (!this.sock) throw new Error("Not connected to the bridge.");
    this.lastWriteAt = Date.now();
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
  stop() { return this.write({ type: "stop" }); }
  /** @param {string} id @param {"allow" | "deny"} behavior @param {boolean} always */
  decide(id, behavior, always) { return this.write({ type: "decide", id, behavior, always }); }

  /** Ends the bridge (and its agent) for good. */
  async quit() {
    const r = await exec("node", [script("bridge.mjs"), "quit", "--chat", this.chat, "--state", bridgeDir(), "--agent", this.agent, ...(this.session ? ["--resume", this.session] : [])]);
    if (r.code !== 0) throw new Error(r.stderr.trim() || "Couldn't stop the chat's agent.");
  }

  /** Drops the link. The bridge keeps running for a later pane. */
  close() {
    this.closed = true;
    this.watch?.cancel();
    try { this.sock?.close(); } catch { /* already closed */ }
    this.sock = null;
  }
}

/** @param {string} action @param {string} target */
export async function outputFileAction(action, target) {
  const r = await exec("node", [script("output-files.mjs"), action, target], { timeout: 10000 });
  const result = JSON.parse(r.stdout);
  if (result.error) throw new Error(result.error);
  return result;
}
