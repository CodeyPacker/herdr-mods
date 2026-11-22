// Talking to a chat's agent through its bridge (bridge.mjs).
//
// Each real chat has one bridge, a Node program in a hidden Herdr terminal that runs the agent
// and outlives the pane. The pane finds it by the file it writes, <appHome>/data/hey-chat/bridges/
// <chat>.json ({ port, pid }), starts one when there is none, and talks to it over a local socket:
// one JSON object per line each way. A pane that connects gets every event since the bridge
// started, so a reloaded pane rebuilds the chat from them.
import { exec, hc, readTextFile, appHome, window } from "herdr";
import net from "net";

/** The bridges' folder. */
export function bridgeDir() {
  return `${appHome().replace(/\\/g, "/")}/data/hey-chat/bridges`;
}

/** Which agent CLIs are on PATH, in the shell the bridges run in. @returns {Promise<string[]>} */
export async function findAgents() {
  if (window().platform === "windows") return [];
  const r = await exec("sh", ["-c", 'for a in node claude codex; do command -v "$a" >/dev/null 2>&1 && echo "$a"; done']).catch(() => null);
  return (r?.stdout ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
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
   * @param {{ chat: string, agent: string, cwd: string, session: string | null }} o
   * @param {(ev: any, cx: any) => void} onEvent @param {(cx: any) => void} onClose
   */
  constructor(o, onEvent, onClose) {
    this.chat = o.chat; this.agent = o.agent; this.cwd = o.cwd; this.session = o.session;
    this.onEvent = onEvent; this.onClose = onClose;
    /** @type {import("net").Socket | null} */
    this.sock = null;
    this.closed = false;
  }

  /** The port of this chat's running bridge, or null. */
  async running() {
    const text = await readTextFile(`${bridgeDir()}/${this.chat}.json`).catch(() => null);
    let port = null;
    try { port = Number(JSON.parse(text ?? "").port) || null; } catch { /* none */ }
    return port && await reachable(port) ? port : null;
  }

  /** Starts the bridge in a hidden terminal and waits for its port. @param {any} cx */
  async launch(cx) {
    const self = `${appHome().replace(/\\/g, "/")}/mods/hey-chat/bridge.mjs`;
    const q = (/** @type {string} */ s) => `'${s.replace(/'/g, `'\\''`)}'`;
    const args = ["serve", "--chat", this.chat, "--agent", this.agent, "--cwd", this.cwd, "--state", bridgeDir(), ...(this.session ? ["--resume", this.session] : [])];
    const r = await hc(["run", "--bg", "--no-parent", "--outlive-parent", "--cwd", this.cwd, "--label", "hey-chat=bridge", "--json", "--",
      "sh", "-c", `exec node ${q(self)} ${args.map(q).join(" ")}`]);
    if (r.code !== 0) throw new Error(r.stderr.trim() || "Couldn't start the bridge.");
    for (let i = 0; i < 50; i++) {
      await new Promise((done) => cx.timer.after(100, done));
      const port = await this.running();
      if (port) return port;
    }
    throw new Error("The bridge didn't start. Is node installed?");
  }

  /** Connects, starting the bridge first when it isn't running, then reads its events until the link drops. @param {any} cx */
  async open(cx) {
    const port = (await this.running()) ?? (await this.launch(cx));
    const sock = await net.connect("127.0.0.1", port);
    if (this.closed) { sock.close(); return; }
    this.sock = sock;
    await sock.write(`${JSON.stringify({ role: "pane" })}\n`);
    const reader = new LineReader();
    for (;;) {
      const bytes = await sock.read(65536).catch(() => null);
      if (!bytes) break;
      for (const line of reader.push(bytes)) {
        let ev = null;
        try { ev = JSON.parse(line); } catch { continue; }
        this.onEvent(ev, cx);
      }
      cx.notify();
    }
    this.sock = null;
    if (!this.closed) this.onClose(cx);
  }

  /** @param {any} msg */
  async write(msg) {
    if (!this.sock) throw new Error("Not connected to the bridge.");
    await this.sock.write(`${JSON.stringify(msg)}\n`);
  }

  /** @param {string} text */
  send(text) { return this.write({ type: "send", text }); }
  stop() { return this.write({ type: "stop" }); }
  /** @param {string} id @param {"allow" | "deny"} behavior @param {boolean} always */
  decide(id, behavior, always) { return this.write({ type: "decide", id, behavior, always }); }

  /** Drops the link. The bridge keeps running for a later pane. */
  close() {
    this.closed = true;
    try { this.sock?.close(); } catch { /* already closed */ }
    this.sock = null;
  }
}
