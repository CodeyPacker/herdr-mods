// Finding sockets and processes, probing for HTTP, and ending processes.
// macOS: netstat -anv lists every TCP listener and UDP socket with its owner's pid, other
// users' included. ps fills in the owner's start time, path, user and command.
// Windows: netstat -ano lists them with the owner's pid. Win32_Process (through pwsh)
// fills in the name, start time, path and command. taskkill ends processes.

import { exec, window as win } from "herdr";
import net from "net";

const isWindows = () => win()?.platform === "windows";

/** What "end" sends, for messages: SIGTERM on macOS, a close request on Windows. */
export const endName = () => (isWindows() ? "a close request" : "SIGTERM");
/** What "force kill" sends, for messages. */
export const killName = () => (isWindows() ? "taskkill /F" : "SIGKILL");

/** @typedef {"tcp" | "udp"} Proto */
/** @typedef {{ key: string, proto: Proto, family: "4" | "6" | "46", addr: string, port: number, pid: number | null, pname: string }} Binding */
/** @typedef {{ pid: number, user: string, start: string, path: string, args: string }} ProcInfo */
/** @typedef {{ bindings: Binding[], procs: Record<number, ProcInfo>, complete: boolean, errors: string[], at: number }} Scan */

/** @param {unknown} e */
export const errorText = (e) => (e instanceof Error ? e.message : String(e));

/** @param {string} cmd @param {string[]} args */
async function run(cmd, args) {
  try {
    return await exec(cmd, args);
  } catch (e) {
    return { code: -1, stdout: "", stderr: errorText(e) };
  }
}

/**
 * "127.0.0.1.7265" -> ["127.0.0.1", 7265], "*.5000" -> ["*", 5000], "fe80::1%lo0.5353" -> ["fe80::1%lo0", 5353].
 * A socket with no port yet ("*.*") gives null.
 * @param {string} s @returns {[string, number] | null}
 */
export function splitAddress(s) {
  const i = s.lastIndexOf(".");
  if (i < 0) return null;
  const port = Number(s.slice(i + 1));
  if (!Number.isInteger(port) || port <= 0) return null;
  return [s.slice(0, i), port];
}

// proto, recv-q, send-q, local, foreign, then the rest.
const LINE = /^(tcp|udp)(46|4|6)\s+\d+\s+\d+\s+(\S+)\s+(\S+)\s+(.*)$/;
// [state] rxbytes txbytes rhiwat shiwat name:pid, then hex flags. Names can hold spaces.
const REST = /^(?:([A-Z_0-9]+)\s+)?\d+\s+\d+\s+\d+\s+\d+\s+(.+?):(-?\d+)\s+[0-9a-f]{5}\s/;

/**
 * TCP listeners and UDP sockets with a local port and no fixed peer. Connected UDP
 * sockets are left out, like established TCP connections.
 * @param {string} text netstat -anv output @returns {Binding[]}
 */
export function parseNetstat(text) {
  /** @type {Map<string, Binding>} */
  const out = new Map();
  for (const line of text.split("\n")) {
    const m = LINE.exec(line.trim());
    if (!m) continue;
    const [, p, fam, local, foreign, rest] = m;
    const r = REST.exec(rest);
    if (!r) continue;
    const proto = /** @type {Proto} */ (p);
    if (proto === "tcp" && r[1] !== "LISTEN") continue;
    if (proto === "udp" && foreign !== "*.*") continue;
    const a = splitAddress(local);
    if (!a) continue;
    const pid = Number(r[3]) > 0 ? Number(r[3]) : null;
    const family = /** @type {Binding["family"]} */ (fam);
    const key = `${proto}|${family}|${a[0]}|${a[1]}|${pid ?? "-"}`;
    // The same binding seen twice is one binding.
    if (!out.has(key)) out.set(key, { key, proto, family, addr: a[0], port: a[1], pid, pname: r[2].trim() });
  }
  return [...out.values()];
}

// Windows netstat -ano: proto, local, foreign, [state], pid. UDP has no state.
const WIN_LINE = /^(TCP|UDP)\s+(\S+)\s+(\S+)\s+(?:(\S+)\s+)?(\d+)$/;

/**
 * "0.0.0.0:135" -> ["*", "4", 135], "[::1]:3000" -> ["::1", "6", 3000]. The
 * any-address becomes "*", as on macOS.
 * @param {string} s @returns {[string, "4" | "6", number] | null}
 */
export function splitWindowsAddress(s) {
  const i = s.lastIndexOf(":");
  if (i < 0) return null;
  const port = Number(s.slice(i + 1));
  if (!Number.isInteger(port) || port <= 0) return null;
  const v6 = s.startsWith("[");
  const host = v6 ? s.slice(1, i - 1) : s.slice(0, i);
  const any = host === "0.0.0.0" || host === "::";
  return [any ? "*" : host, v6 ? "6" : "4", port];
}

/**
 * TCP listeners and UDP sockets with no fixed peer, from Windows netstat -ano.
 * The process name comes later, from readProcs.
 * @param {string} text @returns {Binding[]}
 */
export function parseWindowsNetstat(text) {
  /** @type {Map<string, Binding>} */
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = WIN_LINE.exec(line.trim());
    if (!m) continue;
    const [, p, local, foreign, state, pidText] = m;
    const proto = /** @type {Proto} */ (p.toLowerCase());
    if (proto === "tcp" && state !== "LISTENING") continue;
    if (proto === "udp" && foreign !== "*:*") continue;
    const a = splitWindowsAddress(local);
    if (!a) continue;
    const pid = Number(pidText) > 0 ? Number(pidText) : null;
    const key = `${proto}|${a[1]}|${a[0]}|${a[2]}|${pid ?? "-"}`;
    if (!out.has(key)) out.set(key, { key, proto, family: a[1], addr: a[0], port: a[2], pid, pname: "" });
  }
  return [...out.values()];
}

/**
 * Name, start time and executable for each pid, from Win32_Process. No user: the
 * owner lookup takes over a second per process, too slow for a 5 s refresh.
 * @param {number[]} pids @returns {Promise<{ procs: Record<number, ProcInfo & { name: string }>, error: string | null }>}
 */
async function readWindowsProcs(pids) {
  /** @type {Record<number, ProcInfo & { name: string }>} */
  const procs = {};
  const ids = pids.filter((p) => Number.isInteger(p) && p > 0);
  if (!ids.length) return { procs, error: null };
  const script = [
    "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)",
    `@(Get-CimInstance Win32_Process -Filter '${ids.map((p) => `ProcessId=${p}`).join(" OR ")}' | ForEach-Object {`,
    "  [pscustomobject]@{ pid = [int]$_.ProcessId; name = $_.Name; start = $(if ($_.CreationDate) { $_.CreationDate.ToString('yyyy-MM-dd HH:mm:ss') } else { '' }); path = $_.ExecutablePath; args = $_.CommandLine }",
    "}) | ConvertTo-Json -Compress -AsArray",
  ].join("\n");
  const r = await run("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script]);
  if (r.code !== 0) return { procs, error: `Win32_Process: ${(r.stderr || `exit ${r.code}`).trim()}` };
  /** @type {{ pid: number, name: string | null, start: string, path: string | null, args: string | null }[]} */
  let rows;
  try {
    rows = JSON.parse(r.stdout || "[]");
  } catch (e) {
    return { procs, error: `Win32_Process: ${errorText(e)}` };
  }
  for (const row of rows) {
    procs[row.pid] = { pid: row.pid, name: (row.name ?? "").replace(/\.exe$/i, ""), user: "", start: row.start, path: row.path ?? "", args: row.args ?? "" };
  }
  return { procs, error: null };
}

const LSTART = /^\s*(\d+)\s+(\S+)\s+(\w{3} \w{3} [ \d]\d \d\d:\d\d:\d\d \d{4})\s+(.*)$/;

/**
 * Start time, user and executable for each pid. ps exits 1 when some pid is gone,
 * so the output counts, not the code.
 * @param {number[]} pids @returns {Promise<{ procs: Record<number, ProcInfo>, error: string | null }>}
 */
export async function readProcs(pids) {
  if (isWindows()) return readWindowsProcs(pids);
  /** @type {Record<number, ProcInfo>} */
  const procs = {};
  if (!pids.length) return { procs, error: null };
  const list = pids.join(",");
  // comm and args each go last so neither is cut to the column width.
  const [a, b] = await Promise.all([
    run("ps", ["-ww", "-o", "pid=,user=,lstart=,comm=", "-p", list]),
    run("ps", ["-ww", "-o", "pid=,args=", "-p", list]),
  ]);
  if (a.code === -1 || (!a.stdout.trim() && a.code !== 0 && a.code !== 1)) return { procs, error: `ps: ${(a.stderr || "failed").trim()}` };
  for (const line of a.stdout.split("\n")) {
    const m = LSTART.exec(line);
    if (m) procs[Number(m[1])] = { pid: Number(m[1]), user: m[2], start: m[3], path: m[4].trim(), args: "" };
  }
  for (const line of b.stdout.split("\n")) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (m && procs[Number(m[1])]) procs[Number(m[1])].args = m[2].trim();
  }
  return { procs, error: null };
}

/** One full scan. Never throws: failures land in `errors` and `complete` goes false. @returns {Promise<Scan>} */
export async function scan() {
  /** @type {string[]} */
  const errors = [];
  if (isWindows()) {
    const r = await run("netstat", ["-ano"]);
    const bindings = r.code === 0 ? parseWindowsNetstat(r.stdout) : [];
    if (r.code !== 0) errors.push(`netstat: ${(r.stderr || `exit ${r.code}`).trim()}`);
    const pids = [...new Set(bindings.map((b) => b.pid).filter((p) => p !== null))];
    const { procs, error } = await readWindowsProcs(/** @type {number[]} */ (pids));
    if (error) errors.push(error);
    for (const b of bindings) if (b.pid !== null) b.pname = procs[b.pid]?.name ?? "";
    return { bindings, procs, complete: errors.length === 0, errors, at: Date.now() };
  }
  const [tcp, udp] = await Promise.all([run("netstat", ["-anv", "-p", "tcp"]), run("netstat", ["-anv", "-p", "udp"])]);
  /** @type {Binding[]} */
  const bindings = [];
  for (const [name, r] of /** @type {const} */ ([["tcp", tcp], ["udp", udp]])) {
    if (r.code !== 0) errors.push(`netstat ${name}: ${(r.stderr || `exit ${r.code}`).trim()}`);
    else bindings.push(...parseNetstat(r.stdout));
  }
  const pids = [...new Set(bindings.map((b) => b.pid).filter((p) => p !== null))];
  const { procs, error } = await readProcs(/** @type {number[]} */ (pids));
  if (error) errors.push(error);
  return { bindings, procs, complete: errors.length === 0, errors, at: Date.now() };
}

/** A process instance: pid, start time and executable. A reused pid has a different start. @param {ProcInfo} p */
export const identity = (p) => `${p.pid}|${p.start}|${p.path}`;

/** The identity of whatever has this pid now, or null when nothing does. @param {number} pid */
export async function currentIdentity(pid) {
  const { procs } = await readProcs([pid]);
  return procs[pid] ? identity(procs[pid]) : null;
}

/** Sends a signal. @param {number} pid @param {"TERM" | "KILL"} sig @returns {Promise<string | null>} the error, or null */
export async function signal(pid, sig) {
  if (isWindows()) {
    // Without /F, taskkill asks the process to close. Console programs refuse that,
    // which shows as an error and offers Force Kill.
    const r = await run("taskkill", [...(sig === "KILL" ? ["/F"] : []), "/PID", String(pid)]);
    return r.code === 0 ? null : (r.stderr || r.stdout || `taskkill exited ${r.code}`).trim().replace(/^ERROR:\s*/, "");
  }
  const r = await run("/bin/kill", [`-${sig}`, String(pid)]);
  return r.code === 0 ? null : (r.stderr || `kill exited ${r.code}`).trim().replace(/^kill: \d+: /, "");
}

// HTTP probes

/** Where a browser should go for this binding: the loopback address for a wildcard. @param {Binding} b */
export function hostFor(b) {
  if (b.addr === "*") return b.family === "6" ? "::1" : "127.0.0.1";
  return b.addr;
}

/** "http://127.0.0.1:3000", "http://[::1]:3000", zone ids escaped. @param {Binding} b @param {"http" | "https"} scheme */
export function urlFor(b, scheme) {
  const h = hostFor(b);
  const host = h.includes(":") ? `[${h.replace("%", "%25")}]` : h;
  return `${scheme}://${host}:${b.port}`;
}

/** Only absolute http/https URLs with a host. @param {string} s */
export const validUrl = (s) => /^https?:\/\/[^\s/?#]+(?:[/?#]\S*)?$/i.test(s.trim());

const PROBE_MS = 1000;

// A minimal TLS ClientHello. net's write takes strings, so every byte stays below 0x80:
// record 16 03 01, handshake 01, version 03 03, 32 random bytes, no session,
// suites 13 01 / 13 02 / 00 2f / 00 35, no compression, no extensions.
const HELLO = String.fromCharCode(
  0x16, 0x03, 0x01, 0x00, 0x31,
  0x01, 0x00, 0x00, 0x2d,
  0x03, 0x03, ...Array.from({ length: 32 }, (_, i) => i + 1),
  0x00,
  0x00, 0x08, 0x13, 0x01, 0x13, 0x02, 0x00, 0x2f, 0x00, 0x35,
  0x01, 0x00,
);

/**
 * HTTP first: a bare request answered with "HTTP/" is HTTP. Otherwise a TLS hello:
 * a handshake (0x16) or alert (0x15) record back means HTTPS. Silence, other bytes or a
 * timeout is unknown. No content is fetched, so no certificate is accepted on anyone's behalf.
 * @param {string} host @param {number} port
 * @param {(ms: number, fn: () => void) => void} after a timer from the calling task's cx
 * @returns {Promise<"http" | "https" | "unknown">}
 */
export async function probe(host, port, after) {
  const first = await ask(host, port, "HEAD / HTTP/1.0\r\nHost: localhost\r\n\r\n", after);
  if (first && String.fromCharCode(...first.slice(0, 5)) === "HTTP/") return "http";
  const tls = await ask(host, port, HELLO, after);
  return tls && (tls[0] === 0x16 || tls[0] === 0x15) && tls[1] === 0x03 ? "https" : "unknown";
}

/**
 * Connects, sends, and returns the first bytes back, or null. Neither net nor fetch takes a
 * timeout, so the wait is cut by a race and the socket closed.
 * @param {string} host @param {number} port @param {string} payload
 * @param {(ms: number, fn: () => void) => void} after
 * @returns {Promise<Uint8Array | null>}
 */
async function ask(host, port, payload, after) {
  /** @type {import("net").Socket | null} */
  let sock = null;
  let over = false;
  const shut = () => { try { sock?.close(); } catch {} sock = null; };
  /** @type {Promise<null>} */
  const late = new Promise((ok) => after(PROBE_MS, () => { over = true; shut(); ok(null); }));
  /** @type {Promise<Uint8Array | null>} */
  const work = (async () => {
    try {
      const s = await net.connect(host, port);
      // A connect that finishes after the timeout is closed at once.
      if (over) { try { s.close(); } catch {} return null; }
      sock = s;
      await s.write(payload);
      const bytes = await s.read(16);
      return bytes && bytes.length ? bytes : null;
    } catch {
      return null;
    }
  })();
  const result = await Promise.race([work, late]);
  shut();
  return result;
}
