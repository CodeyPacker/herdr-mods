// portal: local TCP listeners and UDP sockets on macOS and Windows, grouped by the process that owns them.
// Favorite ports, open them in the browser, copy values, end the owning process.
//
// Keys: j/k move, space expands, enter opens a port in the browser, f favorites it,
// n adds a favorite by number, e sets a port's URL, x ends a process, c / shift-c copy,
// t/u/m/a toggle filters, / and p type a filter, s / shift-s sort, r refresh, esc closes.
// Settings in mod.json, overridden by ~/.config/herdr-app/portal.json: "refresh" (seconds, default 5)
// and "star" (a theme color name or hex for every star, default "accent").

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, v_virtual_list, VirtualListScrollHandle, Scrollbar, Popover } from "gpui-base";
import { props, closeOverlay, window as win, readTextFile, appHome } from "herdr";
import { colors, SIZE } from "./kit/theme.js";
import { frame, divider } from "./kit/frame.js";
import { chip, toolButton } from "./kit/controls.js";
import { legend } from "./kit/legend.js";
import { listRow } from "./kit/list.js";
import { scan, identity, currentIdentity, signal, probe, hostFor, urlFor, validUrl, endName, killName } from "./scan.js";

/** @typedef {import("gpui-kit").Color} Color */
/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("gpui-kit").FocusHandle} FocusHandle */
/** @typedef {import("./kit/theme.js").Theme} Theme */
/** @typedef {import("./scan.js").Binding} Binding */
/** @typedef {import("./scan.js").ProcInfo} ProcInfo */
/** @typedef {import("./scan.js").Scan} Scan */
/** @typedef {{ key: string, pid: number | null, name: string, info: ProcInfo | null, all: Binding[], shown: Binding[] }} Group */
/** @typedef {"name" | "pid" | "port"} SortBy */
/** @typedef {"all" | "loopback" | "wildcard" | "specific"} AddrMode */
/**
 * @typedef {{ kind: "head", id: string, text: string, right?: string }
 *   | { kind: "fav", id: string, port: number, bindings: Binding[], state: "active" | "offline" | "unknown" }
 *   | { kind: "proc", id: string, g: Group }
 *   | { kind: "detail", id: string, label: string, value: string }
 *   | { kind: "bind", id: string, b: Binding, g: Group }
 *   | { kind: "empty", id: string, text: string }} Item
 */
/**
 * @typedef {{ phase: "ask" | "term" | "stuck" | "askForce" | "force", pid: number, name: string, ident: string,
 *   ports: number[], total: number, hidden: number, msg: string }} Kill
 */

const DEFAULT_REFRESH = 5;
// svg() only loads from inside ~/.config/herdr-app, and a symlinked mod folder points outside it,
// so icons come from the shipped workspace-chrome mod or are text.
const PLUS = "mods/workspace-chrome/plus.svg";
const CHEVRON = "mods/workspace-chrome/chevron-down.svg";
const SORTS = /** @type {SortBy[]} */ (["name", "pid", "port"]);
const ADDRS = /** @type {AddrMode[]} */ (["all", "loopback", "wildcard", "specific"]);
const ADDR_LABEL = { all: "All addresses", loopback: "Loopback", wildcard: "Wildcard", specific: "Specific" };
const GRACE_MS = 5000;
const FORCE_WAIT_MS = 3000;
const PROBES_AT_ONCE = 4;
const SPIN = "mods/workspace-chrome/spinner.svg";
// Row heights by kind. The virtual list needs each one up front. Rows that can be selected use the kit's compact row.
const H = { head: 28, fav: SIZE.compactRow, proc: SIZE.compactRow, detail: 22, bind: SIZE.compactRow, empty: 34 };

/** @param {string} key @param {any} fallback */
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}
/** @param {string} key @param {unknown} value */
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

/** "*:5000", "127.0.0.1:3000", "[::1]:8080". @param {Binding} b */
const where = (b) => (b.addr.includes(":") ? `[${b.addr}]:${b.port}` : `${b.addr}:${b.port}`);
const FAMILY = { "4": "IPv4", "6": "IPv6", "46": "IPv4+6" };
/** @param {Binding} b */
const isLoopback = (b) => /^127\./.test(b.addr) || b.addr === "::1";
/** @param {number} ms */
const clock = (ms) => new Date(ms).toTimeString().slice(0, 8);

/** "3000" or "3000-3999", inclusive. Empty is no filter. @param {string} s @returns {{ lo: number, hi: number } | null | "bad"} */
function parseRange(s) {
  const v = s.trim();
  if (!v) return null;
  const m = /^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/.exec(v);
  if (!m) return "bad";
  const lo = Number(m[1]), hi = Number(m[2] ?? m[1]);
  if (lo < 1 || hi > 65535 || lo > hi) return "bad";
  return { lo, hi };
}

export default class Portal extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    /** @type {FocusHandle} */
    this.handle = cx.focus_handle();
    const platform = win()?.platform;
    this.supported = platform === "macos" || platform === "windows";
    if (!this.supported) return;
    // Kept across opens.
    /** @type {number[]} */
    this.favs = load("favs", []);
    /** @type {Record<string, string>} "port|addr" -> URL */
    this.urls = load("urls", {});
    /** @type {{ by: SortBy, desc: boolean }} */
    this.sort = load("sort", { by: "port", desc: false });
    // Settings: mod.json ships the defaults, ~/.config/herdr-app/portal.json overrides them.
    /** @type {number} seconds between scans */
    this.interval = DEFAULT_REFRESH;
    /** @type {string} a theme color name ("accent", "ansi3") or a hex color, for every star */
    this.starColor = "accent";
    cx.spawn(async (cx) => {
      for (const file of ["mods/portal/mod.json", "portal.json"]) {
        try {
          const c = JSON.parse(await readTextFile(`${appHome()}/${file}`));
          if (typeof c.refresh === "number" && c.refresh >= 1) this.interval = c.refresh;
          if (typeof c.star === "string" && c.star) this.starColor = c.star;
        } catch {}
      }
      cx.notify();
    });
    this.addrOpen = false;
    // Reset every open.
    this.filter = { tcp: true, udp: false, favOnly: false, addr: /** @type {AddrMode} */ ("all"), text: "", range: "" };
    /** @type {Set<string>} group keys */
    this.expanded = new Set();
    /** @type {string | null} */
    this.selKey = null;
    this.selIdx = 0;
    /** @type {Scan | null} the last scan shown */
    this.data = null;
    /** @type {number | null} */
    this.lastOk = null;
    /** @type {string[]} */
    this.errors = [];
    this.scanning = false;
    this.lastStart = 0;
    this.seq = 0;
    /** @type {Record<string, "http" | "https" | "unknown" | "pending">} by host|port|pid */
    this.probes = {};
    /** @type {{ key: string, host: string, port: number }[]} */
    this.queue = [];
    this.probing = 0;
    /** @type {Kill | null} */
    this.kill = null;
    /** @type {{ ports: number[], pid: number } | null} ports to report on after the process ended */
    this.watch = null;
    /** @type {{ text: string, bad?: boolean } | null} */
    this.note = null;
    /** @type {"text" | "range" | "edit" | null} which box has the keyboard */
    this.typing = null;
    /** @type {{ kind: "url", b: Binding } | { kind: "fav" } | null} what the bottom box is for */
    this.editing = null;

    this.textIn = this.box("text", "Process name, path or pid", (v) => { this.filter.text = v; });
    this.rangeIn = this.box("range", "Ports, e.g. 3000-3999", (v) => { this.filter.range = v; });
    /** @type {ReturnType<typeof InputState.new> | null} */
    this.editIn = null;
    this.scroll = VirtualListScrollHandle.new();

    this.handle.focus();
    cx.timer.after(600, () => { if (!this.typing) this.handle.focus(); });
    this.refresh(cx);
    // One tick a second decides whether a scan is due. It only redraws when one starts.
    cx.timer.every(1000, (cx) => {
      if (!this.scanning && Date.now() - this.lastStart >= this.interval * 1000) this.refresh(cx);
    });
  }

  /** A filter box. @param {"text" | "range"} name @param {string} placeholder @param {(v: string) => void} set */
  box(name, placeholder, set) {
    const s = InputState.new({ placeholder });
    s.on("change", (_e, cx) => { set(s.value()); cx.notify(); });
    s.on("focus", (_e, cx) => { this.typing = name; cx.notify(); });
    s.on("blur", (_e, cx) => { if (this.typing === name) this.typing = null; cx.notify(); });
    s.on("submit", (_e, cx) => { this.handle.focus(); cx.notify(); });
    return s;
  }

  close() {
    closeOverlay(props().overlay);
  }

  // Scanning

  /** Starts a scan unless one is running. Results from an older scan never land over a newer one. @param {Context} cx */
  refresh(cx) {
    if (this.scanning) return;
    this.scanning = true;
    this.lastStart = Date.now();
    const seq = ++this.seq;
    cx.notify();
    cx.spawn(async (cx) => {
      const s = await scan();
      if (seq !== this.seq) return;
      this.scanning = false;
      if (s.complete) { this.data = s; this.lastOk = s.at; this.errors = []; }
      else {
        // Keep the last good list. Show the partial one only when there is nothing else.
        this.errors = s.errors;
        if (!this.data) this.data = s;
      }
      this.queueProbes(cx);
      if (s.complete && this.watch) this.reportPorts();
      cx.notify();
    });
  }

  /** Probes TCP bindings not probed yet, a few at a time, outside the scan. @param {Context} cx */
  queueProbes(cx) {
    for (const b of this.data?.bindings ?? []) {
      if (b.proto !== "tcp") continue;
      const key = this.probeKey(b);
      if (this.probes[key]) continue;
      this.probes[key] = "pending";
      this.queue.push({ key, host: hostFor(b), port: b.port });
    }
    this.pump(cx);
  }

  /** @param {Context} cx */
  pump(cx) {
    while (this.probing < PROBES_AT_ONCE && this.queue.length) {
      const job = /** @type {{ key: string, host: string, port: number }} */ (this.queue.shift());
      this.probing++;
      cx.spawn(async (cx) => {
        this.probes[job.key] = await probe(job.host, job.port, (ms, fn) => cx.timer.after(ms, fn));
        this.probing--;
        this.pump(cx);
        cx.notify();
      });
    }
  }

  /** @param {Binding} b */
  probeKey(b) { return `${hostFor(b)}|${b.port}|${b.pid ?? "-"}`; }

  /** The browser URL: the person's override, else what the probe found. @param {Binding} b @returns {string | null} */
  urlOf(b) {
    const own = this.urls[`${b.port}|${b.addr}`];
    if (own) return own;
    if (b.proto !== "tcp") return null;
    const p = this.probes[this.probeKey(b)];
    return p === "http" || p === "https" ? urlFor(b, p) : null;
  }

  // Shaping the list

  /** @param {Binding} b */
  passes(b) {
    const f = this.filter;
    if (!(b.proto === "tcp" ? f.tcp : f.udp)) return false;
    if (f.favOnly && !this.favs.includes(b.port)) return false;
    if (!this.addrPasses(b)) return false;
    const r = parseRange(f.range);
    if (r && r !== "bad" && (b.port < r.lo || b.port > r.hi)) return false;
    const q = f.text.trim().toLowerCase();
    if (q) {
      const info = b.pid ? this.data?.procs[b.pid] : null;
      const hay = [b.pname, String(b.pid ?? ""), info?.path ?? "", info?.args ?? ""].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  /** @param {Binding} b */
  addrPasses(b) {
    const a = this.filter.addr;
    if (a === "loopback") return isLoopback(b);
    if (a === "wildcard") return b.addr === "*";
    if (a === "specific") return b.addr !== "*" && !isLoopback(b);
    return true;
  }

  /** How many distinct bindings use each port number, across everything found. */
  shareCounts() {
    /** @type {Map<number, number>} */
    const n = new Map();
    for (const b of this.data?.bindings ?? []) n.set(b.port, (n.get(b.port) ?? 0) + 1);
    return n;
  }

  /** Every process instance with at least one binding that passes the filters, sorted. @returns {Group[]} */
  groups() {
    const procs = this.data?.procs ?? {};
    /** @type {Map<string, Group>} */
    const by = new Map();
    for (const b of this.data?.bindings ?? []) {
      const info = b.pid ? procs[b.pid] ?? null : null;
      const key = info ? identity(info) : b.pid ? `pid|${b.pid}` : "unknown";
      let g = by.get(key);
      if (!g) {
        const name = b.pid ? b.pname || info?.path.split(/[\\/]/).pop() || `pid ${b.pid}` : "Owner unavailable";
        g = { key, pid: b.pid, name, info, all: [], shown: [] };
        by.set(key, g);
      }
      g.all.push(b);
      if (this.passes(b)) g.shown.push(b);
    }
    const low = (/** @type {Group} */ g) => Math.min(...g.shown.map((b) => b.port));
    const dir = this.sort.desc ? -1 : 1;
    const list = [...by.values()].filter((g) => g.shown.length);
    for (const g of list) g.shown.sort((a, b) => a.port - b.port || a.proto.localeCompare(b.proto) || a.key.localeCompare(b.key));
    return list.sort((a, b) => {
      const c = this.sort.by === "name" ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        : this.sort.by === "pid" ? (a.pid ?? 0) - (b.pid ?? 0)
        : low(a) - low(b);
      return c * dir || (a.pid ?? 0) - (b.pid ?? 0) || a.key.localeCompare(b.key);
    });
  }

  /** @returns {{ items: Item[], groups: Group[], favShown: number }} */
  build() {
    /** @type {Item[]} */
    const items = [];
    const data = this.data;
    const groups = this.groups();
    const all = data?.bindings ?? [];
    const range = parseRange(this.filter.range);
    // Inactive favorites have no protocol, address or owner, so only the port range and
    // the process and address filters can hide them.
    const blocked = !!this.filter.text.trim() || this.filter.addr !== "all";
    /** @type {Item[]} */
    const favs = [];
    for (const port of [...this.favs].sort((a, b) => a - b)) {
      const on = all.filter((b) => b.port === port);
      if (range && range !== "bad" && (port < range.lo || port > range.hi)) continue;
      if (on.length) {
        if (!on.some((b) => this.passes(b))) continue;
        favs.push({ kind: "fav", id: `fav-${port}`, port, bindings: on, state: "active" });
      } else {
        if (blocked) continue;
        // Offline only after a complete scan saw nothing on it.
        const state = this.lastOk && !this.errors.length ? "offline" : "unknown";
        favs.push({ kind: "fav", id: `fav-${port}`, port, bindings: [], state });
      }
    }
    if (this.favs.length) {
      items.push({ kind: "head", id: "h-favs", text: "Favorites", right: favs.length < this.favs.length ? `${this.favs.length - favs.length} hidden by filters` : "" });
      items.push(...favs);
      if (!favs.length) items.push({ kind: "empty", id: "e-favs", text: "No favorites match the filters." });
    }
    const label = { name: "name", pid: "PID", port: "lowest port" }[this.sort.by];
    items.push({ kind: "head", id: "h-procs", text: "Processes", right: `by ${label} ${this.sort.desc ? "↓" : "↑"}` });
    if (!data) items.push({ kind: "empty", id: "e-wait", text: this.errors.length ? this.errors.join(" · ") : "Scanning…" });
    else if (!groups.length) items.push({ kind: "empty", id: "e-none", text: all.length ? "No bindings match the filters." : "No listeners found." });
    for (const g of groups) {
      items.push({ kind: "proc", id: `proc-${g.key}`, g });
      if (!this.expanded.has(g.key)) continue;
      const i = g.info;
      if (g.pid) items.push({ kind: "detail", id: `d-pid-${g.key}`, label: "PID", value: String(g.pid) });
      if (i?.user) items.push({ kind: "detail", id: `d-user-${g.key}`, label: "User", value: i.user });
      if (i?.start) items.push({ kind: "detail", id: `d-start-${g.key}`, label: "Started", value: i.start });
      if (i?.path) items.push({ kind: "detail", id: `d-path-${g.key}`, label: "Path", value: i.path });
      if (i?.args) items.push({ kind: "detail", id: `d-cmd-${g.key}`, label: "Command", value: i.args });
      if (g.pid && !i) items.push({ kind: "detail", id: `d-na-${g.key}`, label: "Details", value: "unavailable" });
      for (const b of g.shown) items.push({ kind: "bind", id: `bind-${b.key}`, b, g });
    }
    return { items, groups, favShown: favs.length };
  }

  /** Where the selection is now: by key, else the same position, else the nearest row that can be selected. @param {Item[]} items */
  selection(items) {
    const ok = (/** @type {Item | undefined} */ it) => it?.kind === "fav" || it?.kind === "proc" || it?.kind === "bind";
    let i = this.selKey ? items.findIndex((it) => it.id === this.selKey) : -1;
    if (i < 0) {
      i = Math.min(this.selIdx, items.length - 1);
      let j = i;
      while (j >= 0 && !ok(items[j])) j--;
      if (j < 0) { j = i; while (j < items.length && !ok(items[j])) j++; }
      i = j < items.length ? j : -1;
    }
    if (i >= 0) { this.selIdx = i; this.selKey = items[i].id; }
    return i;
  }

  /** @param {Item[]} items @param {number} at @param {number} step */
  move(items, at, step) {
    let j = at + step;
    while (j >= 0 && j < items.length && !["fav", "proc", "bind"].includes(items[j].kind)) j += step;
    if (j < 0 || j >= items.length) return;
    this.selIdx = j;
    this.selKey = items[j].id;
    this.scroll.scroll_to_item(j);
  }

  /** The group a row belongs to. A favorite belongs to its owner when exactly one process holds it. @param {Item | undefined} it @param {Group[]} groups */
  groupOf(it, groups) {
    if (it?.kind === "proc" || it?.kind === "bind") return it.g;
    if (it?.kind === "fav") {
      const keys = new Set(it.bindings.map((b) => b.pid));
      if (keys.size !== 1) return null;
      const pid = [...keys][0];
      return groups.find((g) => g.pid === pid) ?? this.groupForPid(pid);
    }
    return null;
  }

  /** A favorite's owner may be hidden by filters, so build its group from the full list. @param {number | null} pid @returns {Group | null} */
  groupForPid(pid) {
    if (!pid || !this.data) return null;
    const all = this.data.bindings.filter((b) => b.pid === pid);
    const info = this.data.procs[pid] ?? null;
    return { key: info ? identity(info) : `pid|${pid}`, pid, name: all[0]?.pname ?? `pid ${pid}`, info, all, shown: all.filter((b) => this.passes(b)) };
  }

  /** The binding a row is about: a binding row's own, a favorite's first TCP one. @param {Item | undefined} it @returns {Binding | null} */
  bindingOf(it) {
    if (it?.kind === "bind") return it.b;
    if (it?.kind === "fav") return it.bindings.find((b) => b.proto === "tcp") ?? it.bindings[0] ?? null;
    return null;
  }

  // Actions

  /** @param {string} text @param {boolean} [bad] */
  say(text, bad = false) { this.note = { text, bad }; }

  /** @param {Context} cx @param {string} value @param {string} what */
  copy(cx, value, what) {
    cx.write_to_clipboard(value);
    this.say(`Copied ${what}`);
  }

  /** @param {Group} g */
  details(g) {
    const i = g.info;
    return [
      `${g.name}${g.pid ? ` (pid ${g.pid})` : ""}`,
      i?.user ? `User: ${i.user}` : null,
      i?.start ? `Started: ${i.start}` : null,
      i?.path ? `Path: ${i.path}` : null,
      i?.args ? `Command: ${i.args}` : null,
      ...g.all.map((b) => `${b.proto.toUpperCase()} ${FAMILY[b.family]} ${where(b)}`),
    ].filter(Boolean).join("\n");
  }

  /** @param {Context} cx @param {Binding | null} b */
  open(cx, b) {
    if (!b) { this.say("Nothing is listening on this port", true); return; }
    const url = this.urlOf(b);
    if (!url) {
      const p = this.probes[this.probeKey(b)];
      this.say(p === "pending" ? "Still checking for HTTP. Try again in a second." : `${where(b)} didn't answer as HTTP. Press e to set a URL.`, true);
      return;
    }
    cx.open_url(url);
    this.say(`Opened ${url}`);
  }

  /** @param {number} port */
  toggleFav(port) {
    const had = this.favs.includes(port);
    this.favs = had ? this.favs.filter((p) => p !== port) : [...this.favs, port];
    save("favs", this.favs);
    this.say(had ? `Removed ${port} from favorites` : `Added ${port} to favorites`);
  }

  /** Opens the bottom box. @param {{ kind: "url", b: Binding } | { kind: "fav" }} what @param {Context} cx */
  edit(what, cx) {
    const value = what.kind === "url" ? this.urls[`${what.b.port}|${what.b.addr}`] ?? this.urlOf(what.b) ?? urlFor(what.b, "http") : "";
    const s = InputState.new({ value, placeholder: what.kind === "url" ? "http://127.0.0.1:3000 (empty clears it)" : "Port number" });
    s.set_selected_range({ start: 0, end: value.length });
    s.on("focus", (_e, cx) => { this.typing = "edit"; cx.notify(); });
    s.on("blur", (_e, cx) => { if (this.typing === "edit") this.typing = null; cx.notify(); });
    s.on("submit", (_e, cx) => { this.finishEdit(true); cx.notify(); });
    this.editIn = s;
    this.editing = what;
    s.focus();
    cx.timer.after(50, () => s.focus());
    cx.notify();
  }

  /** @param {boolean} keep */
  finishEdit(keep) {
    const what = this.editing, s = this.editIn;
    if (!what || !s) return;
    const v = s.value().trim();
    if (keep && what.kind === "url") {
      const k = `${what.b.port}|${what.b.addr}`;
      if (!v) { delete this.urls[k]; this.say(`Cleared the URL for ${where(what.b)}`); }
      else if (!validUrl(v)) { this.say("Only http:// and https:// URLs work", true); return; }
      else { this.urls[k] = v; this.say(`${where(what.b)} opens ${v}`); }
      save("urls", this.urls);
    } else if (keep && what.kind === "fav") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 65535) { this.say("A port is a number from 1 to 65535", true); return; }
      if (!this.favs.includes(n)) this.toggleFav(n);
    }
    this.editing = null;
    this.editIn = null;
    this.typing = null;
    this.handle.focus();
  }

  /** Asks before ending the selected row's process. @param {Group | null} g */
  askKill(g) {
    if (!g?.pid) { this.say("This binding has no known owner, so there is nothing to end", true); return; }
    if (!g.info) { this.say(`Can't verify pid ${g.pid}, so Portal won't end it`, true); return; }
    const ident = identity(g.info);
    this.kill = { phase: "ask", pid: g.pid, name: g.name, ident, ports: [...new Set(g.all.map((b) => b.port))], total: g.all.length, hidden: g.all.length - g.shown.length, msg: "" };
  }

  /** Waits for the process to be gone (or replaced). @param {Context} cx @param {Kill} k @param {number} ms @returns {Promise<boolean>} */
  async waitExit(cx, k, ms) {
    const t0 = Date.now();
    for (;;) {
      if ((await currentIdentity(k.pid)) !== k.ident) return true;
      if (Date.now() - t0 >= ms) return false;
      await new Promise((ok) => cx.timer.after(250, () => ok(null)));
    }
  }

  /** SIGTERM, then a 5 s wait. Never moves on to SIGKILL by itself. @param {Context} cx @param {boolean} force */
  async end(cx, force) {
    const k = this.kill;
    if (!k) return;
    k.phase = force ? "force" : "term";
    cx.notify();
    // The pid may belong to something else by now.
    const now = await currentIdentity(k.pid);
    if (now === null) { this.kill = null; this.say(`${k.name} had already exited`); this.refresh(cx); return; }
    if (now !== k.ident) { this.kill = null; this.say(`pid ${k.pid} is a different process now. Nothing was sent.`, true); this.refresh(cx); return; }
    const err = await signal(k.pid, force ? "KILL" : "TERM");
    if (err) {
      if (force) { this.kill = null; this.say(`Force kill failed: ${err}`, true); }
      else { k.phase = "stuck"; k.msg = `Couldn't ask ${k.name} to quit: ${err}.`; }
      cx.notify();
      return;
    }
    const gone = await this.waitExit(cx, k, force ? FORCE_WAIT_MS : GRACE_MS);
    if (gone) {
      this.kill = null;
      this.say(`${k.name} (pid ${k.pid}) exited. Checking its ports…`);
      this.watch = { ports: k.ports, pid: k.pid };
      this.refresh(cx);
    } else if (force) {
      this.kill = null;
      this.say(`${killName()} was sent, but ${k.name} (pid ${k.pid}) is still there`, true);
    } else {
      k.phase = "stuck";
      k.msg = `${k.name} is still running after ${GRACE_MS / 1000} s.`;
    }
    cx.notify();
  }

  /** After a process ended: is anything else on its ports now? A supervisor may have restarted it. */
  reportPorts() {
    const w = this.watch;
    this.watch = null;
    if (!w || !this.data) return;
    const back = this.data.bindings.filter((b) => w.ports.includes(b.port) && b.pid !== w.pid);
    if (!back.length) { this.say(`Ports ${w.ports.join(", ")} are free`); return; }
    const b = back[0];
    this.say(`Port ${b.port} is in use again by ${b.pname} (pid ${b.pid ?? "?"})`);
  }

  // Keys

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    const k = e.keystroke;
    if (this.typing) {
      if (e.key === "escape" || k === "tab") {
        if (this.typing === "edit") { this.editing = null; this.editIn = null; this.typing = null; }
        this.handle.focus();
        cx.stop_propagation();
        cx.notify();
      }
      return;
    }
    if (e.modifiers.control || e.modifiers.alt || e.modifiers.platform) return;
    const { items, groups } = this.build();
    const at = this.selection(items);
    const it = items[at];
    const kill = this.kill;
    if (kill && kill.phase !== "term" && kill.phase !== "force") {
      if (e.key === "escape") this.kill = null;
      else if (k === "enter" && kill.phase === "ask") cx.spawn((cx) => this.end(cx, false));
      else if (k === "enter" && kill.phase === "askForce") cx.spawn((cx) => this.end(cx, true));
      else if (k === "f" && kill.phase === "stuck") kill.phase = "askForce";
      cx.stop_propagation();
      cx.notify();
      return;
    }
    this.note = null;
    if (e.key === "escape" || k === "q") { this.close(); cx.stop_propagation(); return; }
    else if (k === "j" || k === "down") this.move(items, at, 1);
    else if (k === "k" || k === "up") this.move(items, at, -1);
    else if ((k === "l" || k === "right") && it?.kind === "proc") this.expanded.add(it.g.key);
    else if (k === "h" || k === "left") {
      const g = it?.kind === "proc" || it?.kind === "bind" ? it.g : null;
      if (g) { this.expanded.delete(g.key); this.selKey = `proc-${g.key}`; }
    }
    else if (k === "space" || (k === "enter" && it?.kind === "proc")) {
      if (it?.kind === "proc") { if (this.expanded.has(it.g.key)) this.expanded.delete(it.g.key); else this.expanded.add(it.g.key); }
    }
    else if (k === "enter" || k === "o") this.open(cx, this.bindingOf(it));
    else if (k === "f") {
      if (it?.kind === "fav") this.toggleFav(it.port);
      else if (it?.kind === "bind") this.toggleFav(it.b.port);
      else this.say("Select a port to favorite it, or press n to add one by number", true);
    }
    else if (k === "n") this.edit({ kind: "fav" }, cx);
    else if (k === "e") {
      const b = this.bindingOf(it);
      if (b) this.edit({ kind: "url", b }, cx);
      else this.say("Select a port that something is listening on", true);
    }
    else if (k === "x") this.askKill(this.groupOf(it, groups));
    else if (k === "c") {
      if (it?.kind === "proc" && it.g.pid) this.copy(cx, String(it.g.pid), `pid ${it.g.pid}`);
      else if (it?.kind === "bind") this.copy(cx, where(it.b), where(it.b));
      else if (it?.kind === "fav") this.copy(cx, String(it.port), `port ${it.port}`);
    }
    else if (k === "shift-c") {
      const b = this.bindingOf(it);
      if (it?.kind === "proc") this.copy(cx, this.details(it.g), `details of ${it.g.name}`);
      else if (b) {
        const url = this.urlOf(b);
        if (url) this.copy(cx, url, url);
        else this.say("No URL for this port yet. Press e to set one.", true);
      }
    }
    else if (k === "r") this.refresh(cx);
    else if (k === "s") this.setSort(SORTS[(SORTS.indexOf(this.sort.by) + 1) % SORTS.length], this.sort.desc);
    else if (k === "shift-s") this.setSort(this.sort.by, !this.sort.desc);
    else if (k === "t") this.filter.tcp = !this.filter.tcp;
    else if (k === "u") this.filter.udp = !this.filter.udp;
    else if (k === "m") this.filter.favOnly = !this.filter.favOnly;
    else if (k === "a") this.filter.addr = ADDRS[(ADDRS.indexOf(this.filter.addr) + 1) % ADDRS.length];
    else if (k === "/" || e.key === "/") { this.textIn.focus(); }
    else if (k === "p") { this.rangeIn.focus(); }
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  /** A row was clicked: select it, expand a process, copy a detail value. @param {string} key @param {Context} cx */
  clicked(key, cx) {
    const { items } = this.build();
    const i = items.findIndex((it) => it.id === key);
    const it = items[i];
    if (!it) return;
    if (it.kind === "detail") this.copy(cx, it.value, it.label.toLowerCase());
    else if (it.kind === "fav" || it.kind === "proc" || it.kind === "bind") {
      this.selIdx = i;
      this.selKey = it.id;
      if (it.kind === "proc") { if (this.expanded.has(it.g.key)) this.expanded.delete(it.g.key); else this.expanded.add(it.g.key); }
    }
    this.handle.focus();
    cx.notify();
  }

  /** @param {SortBy} by @param {boolean} desc */
  setSort(by, desc) { this.sort = { by, desc }; save("sort", this.sort); }

  // Drawing

  /** The star color from settings, falling back to accent. @param {Theme} t @returns {Color} */
  star(t) {
    const c = this.starColor;
    return /^#[0-9a-f]{3,8}$/i.test(c) ? /** @type {Color} */ (c) : t[c] ?? t.accent;
  }

  /** A toggle or choice at the top. A click also gives the keyboard back to the dialog. @param {Theme} t @param {string} id @param {string | import("gpui-kit").NativeElement} label @param {boolean} on @param {(cx: Context) => void} act */
  chip(t, id, label, on, act) {
    return chip(t, { id, label, on, click: (cx) => { act(cx); this.handle.focus(); cx.notify(); } });
  }

  /** A small toolbar button. Callers add its icon. @param {Theme} t @param {string} id @param {string} tip @param {(cx: Context) => void} act */
  iconButton(t, id, tip, act) {
    return toolButton(t, { id, tip, click: (cx) => { act(cx); this.handle.focus(); cx.notify(); } });
  }

  /** The address filter as a dropdown. @param {Theme} t */
  addrMenu(t) {
    const f = this.filter;
    const on = f.addr !== "all";
    const trigger = h_flex().id("f-addr").flex_none().h(26).pl(10).pr(6).gap(4).items_center().rounded(8).border_1()
      .border_color(on || this.addrOpen ? t.accent : t.border).bg(on ? t.selected : t.raised)
      .text_size(11.5).text_color(on ? t.foreground : t.muted).cursor_pointer()
      .hover((s) => s.border_color(t.accent))
      .child(ADDR_LABEL[f.addr])
      .child(svg(CHEVRON).size(12).flex_none().text_color(t.muted));
    const list = v_flex().w(150).p(4).gap(1).mt(4).rounded(8).border_1().border_color(t.border).bg(t.popover)
      .children(ADDRS.map((a) => h_flex().id(`addr-${a}`).h(26).px(8).items_center().rounded(5).text_size(12)
        .text_color(a === f.addr ? t.foreground : t.muted).when(a === f.addr, (el) => el.bg(t.selected))
        .cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { f.addr = a; this.addrOpen = false; this.handle.focus(); cx.notify(); })
        .child(ADDR_LABEL[a])));
    return Popover.new("addr-menu").anchor("bottom_left").open(this.addrOpen)
      .on_open_change((/** @type {boolean} */ open, /** @type {Context} */ cx) => { this.addrOpen = open; if (!open) this.handle.focus(); cx.notify(); })
      .trigger(trigger).content(list);
  }

  /** A filter box's frame. @param {Theme} t @param {string} id @param {ReturnType<typeof InputState.new>} state @param {boolean} on @param {boolean} bad @param {number | null} w */
  field(t, id, state, on, bad, w) {
    return div().id(id).h(30).px(10).flex().items_center().rounded(8).border_1()
      .border_color(bad ? t.blocked : on ? t.accent : t.border).bg(t.background).cursor_text()
      .when(w === null, (el) => el.flex_1().min_w(0)).when(w !== null, (el) => el.w(w ?? 0).flex_none())
      .on_mouse_down("left", (_e, cx) => { state.focus(); cx.stop_propagation(); })
      .child(Input.new(state).h_full().w_full().text_size(12).text_color(t.foreground));
  }

  /** A small labelled tag. @param {Theme} t @param {string} text @param {Color} color */
  tag(t, text, color) {
    return div().flex_none().px(5).h(16).flex().items_center().rounded(4).border_1().border_color(t.border).text_size(10).text_color(color).child(text);
  }

  /** @param {Theme} t @param {Item} it @param {boolean} on @param {number} i @param {Map<number, number>} shares */
  rowEl(t, it, on, i, shares) {
    if (it.kind === "head") {
      return h_flex().id(it.id).h(H.head).px(10).pb(4).items_end().gap(8).text_size(11)
        .child(div().font_semibold().text_color(t.dim).child(it.text.toUpperCase()))
        .child(div().flex_1())
        .child(div().text_color(t.dim).child(it.right ?? ""));
    }
    if (it.kind === "empty") return h_flex().id(it.id).h(H.empty).px(10).items_center().text_size(12).text_color(t.dim).child(it.text);
    if (it.kind === "detail") {
      const { label, value } = it;
      return h_flex().id(it.id).h(H.detail).pl(44).pr(10).gap(10).items_center().text_size(11).rounded(5).cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .child(div().w(64).flex_none().text_color(t.dim).child(label))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(value));
    }
    const base = listRow(t, { id: it.id, on, compact: true }).gap(8).text_size(13);
    if (it.kind === "fav") {
      const tone = it.state === "active" ? t.ansi2 : t.dim;
      const owners = [...new Set(it.bindings.map((b) => b.pname || "?"))].join(", ");
      const b = this.bindingOf(it);
      const url = b ? this.urlOf(b) : null;
      return base
        .child(div().w(14).flex_none().text_color(this.star(t)).child("★"))
        .child(div().w(56).flex_none().font_semibold().text_color(t.foreground).child(String(it.port)))
        .child(div().w(8).h(8).rounded(4).flex_none().bg(tone))
        .child(div().flex_none().text_size(11.5).text_color(t.muted).child(it.state === "active" ? owners : it.state === "offline" ? "offline" : "not checked yet"))
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(url ?? ""))
        .when((shares.get(it.port) ?? 0) > 1, (el) => el.child(this.tag(t, "Shared port", t.muted)));
    }
    if (it.kind === "proc") {
      const g = it.g;
      const open = this.expanded.has(g.key);
      const ports = [...new Set(g.shown.map((b) => b.port))];
      const list = ports.slice(0, 4).join(", ") + (ports.length > 4 ? ` +${ports.length - 4}` : "");
      const hidden = g.all.length - g.shown.length;
      const shared = ports.some((p) => (shares.get(p) ?? 0) > 1);
      return base
        .child(div().w(12).flex_none().text_color(t.dim).child(open ? "▾" : "▸"))
        .child(div().flex_none().max_w(220).truncate().font_semibold().text_color(g.pid ? t.foreground : t.muted).child(g.name))
        .child(div().flex_none().text_size(11).text_color(t.dim).child(g.pid ? `pid ${g.pid}` : ""))
        .when(!!g.pid && !g.info, (el) => el.child(this.tag(t, "unverified", t.dim)))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.muted).child(list))
        .when(shared, (el) => el.child(this.tag(t, "Shared port", t.muted)))
        .when(hidden > 0, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(`${hidden} hidden`)));
    }
    // A binding under its process.
    const b = it.b;
    const url = this.urlOf(b);
    const p = b.proto === "tcp" ? this.probes[this.probeKey(b)] : null;
    const own = !!this.urls[`${b.port}|${b.addr}`];
    const kind = own ? "URL" : p === "http" ? "HTTP" : p === "https" ? "HTTPS" : p === "pending" ? "…" : "";
    return base.pl(44)
      .child(this.tag(t, b.proto.toUpperCase(), t.muted))
      .child(div().w(48).flex_none().text_size(11).text_color(t.dim).child(FAMILY[b.family]))
      .child(div().flex_none().text_size(12).text_color(t.foreground).child(where(b)))
      .when(this.favs.includes(b.port), (el) => el.child(div().flex_none().text_color(this.star(t)).child("★")))
      .when(!!kind, (el) => el.child(this.tag(t, kind, kind === "…" ? t.dim : t.accent)))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(url ?? ""))
      .when((shares.get(b.port) ?? 0) > 1, (el) => el.child(this.tag(t, "Shared port", t.muted)));
  }

  /** The line under the list: a question, a box, or the last result. @param {Theme} t */
  strip(t) {
    const k = this.kill;
    const line = () => h_flex().flex_none().min_h(34).px(12).gap(10).items_center().rounded(8).border_1().text_size(12);
    if (k) {
      const sockets = `${k.total} socket${k.total === 1 ? "" : "s"}${k.hidden ? ` (${k.hidden} hidden by filters)` : ""}`;
      /** @type {[string, Color, [string, string][]]} */
      const [text, edge, keys] =
        k.phase === "ask" ? [`End ${k.name} (pid ${k.pid})? Sends ${endName()} and closes all ${sockets}.`, t.border, [["enter", "end"], ["esc", "cancel"]]]
        : k.phase === "term" ? [`Asking ${k.name} to quit… waiting up to ${GRACE_MS / 1000} s`, t.border, []]
        : k.phase === "stuck" ? [`${k.msg} Force Kill is available.`, t.blocked, [["f", "force kill"], ["esc", "leave it"]]]
        : k.phase === "askForce" ? [`Force kill ${k.name} (pid ${k.pid})? It can't clean up. Unsaved work may be lost.`, t.blocked, [["enter", "force kill"], ["esc", "cancel"]]]
        : [`Force killing ${k.name}…`, t.blocked, []];
      return line().border_color(edge)
        .when(k.phase === "term" || k.phase === "force", (el) => el.child(svg(SPIN).size(12).flex_none().text_color(t.working).spin(900)))
        .child(div().flex_1().min_w(0).text_color(t.foreground).child(text))
        .child(legend(t, keys));
    }
    if (this.editing && this.editIn) {
      const what = this.editing;
      return line().border_color(t.accent)
        .child(div().flex_none().text_color(t.muted).child(what.kind === "url" ? `URL for ${where(what.b)}` : "Add favorite port"))
        .child(div().flex_1().min_w(0).h(24).flex().items_center().child(Input.new(this.editIn).h_full().w_full().text_size(12).text_color(t.foreground)))
        .child(legend(t, [["enter", "save"], ["esc", "cancel"]]));
    }
    if (this.note) return line().border_color(this.note.bad ? t.blocked : t.border).child(div().flex_1().min_w(0).truncate().text_color(this.note.bad ? t.blocked : t.muted).child(this.note.text));
    return null;
  }

  /** @param {Context} _cx */
  render(_cx) {
    const t = colors();
    if (!this.supported) {
      return frame(t, { id: "portal", title: "Portal", handle: this.handle, fill: true, onKey: (e, cx) => { if (e.key === "escape") this.close(); cx.stop_propagation(); } })
        .child(div().text_color(t.muted).child("Portal supports macOS and Windows only for now."));
    }
    const { items, groups } = this.build();
    const at = this.selection(items);
    const shares = this.shareCounts();
    const f = this.filter;
    const range = parseRange(f.range);

    // Counts, and whether filters cut them.
    const total = this.data?.bindings.length ?? 0;
    const shownB = groups.reduce((n, g) => n + g.shown.length, 0);
    const procsAll = new Set((this.data?.bindings ?? []).map((b) => b.pid ?? "unknown")).size;
    const counts = this.data
      ? `${shownB === total ? total : `${shownB} of ${total}`} bindings · ${groups.length === procsAll ? procsAll : `${groups.length} of ${procsAll}`} processes · ${this.favs.length} favorites`
      : "";

    let status = "";
    /** @type {Color} */
    let statusColor = t.dim;
    if (this.errors.length) {
      status = `${this.lastOk ? `Stale · last ok ${clock(this.lastOk)}` : "Partial"} · ${this.errors[0]}`;
      statusColor = t.blocked;
    } else if (this.lastOk) status = `Updated ${clock(this.lastOk)}`;

    const strip = this.strip(t);
    // Between the title and "Esc": the counts, then when the list was last read.
    const details = h_flex().flex_1().min_w(0).items_center().gap(10)
      .child(div().flex_none().text_size(11.5).text_color(t.dim).child(counts))
      .child(div().flex_1())
      .child(div().flex_none().max_w(320).truncate().text_size(SIZE.small).text_color(statusColor).child(status));
    return frame(t, { id: "portal", title: "Portal", handle: this.handle, fill: true, onKey: (e, cx) => this.key(e, cx), details })
      .child(h_flex().flex_none().items_center().gap(6)
        .child(this.field(t, "f-text", this.textIn, this.typing === "text", false, null))
        .child(this.field(t, "f-range", this.rangeIn, this.typing === "range", range === "bad", 180)))
      .child(h_flex().flex_none().items_center().gap(6).text_size(11).text_color(t.dim)
        .child(this.chip(t, "f-tcp", "TCP", f.tcp, () => { f.tcp = !f.tcp; }))
        .child(this.chip(t, "f-udp", "UDP", f.udp, () => { f.udp = !f.udp; }))
        .child(this.chip(t, "f-fav", div().text_color(this.star(t)).child("★"), f.favOnly, () => { f.favOnly = !f.favOnly; }))
        .child(this.addrMenu(t))
        .child(div().w(10).flex_none())
        .child(div().flex_none().child("Sort"))
        .children(SORTS.map((by) => this.chip(t, `s-${by}`, { name: "Name", pid: "PID", port: "Port" }[by], this.sort.by === by,
          () => this.setSort(by, this.sort.by === by ? !this.sort.desc : this.sort.desc))))
        .child(this.chip(t, "s-dir", this.sort.desc ? "↓ desc" : "↑ asc", false, () => this.setSort(this.sort.by, !this.sort.desc)))
        .child(div().flex_1())
        .child(this.iconButton(t, "r-now", `Refresh (every ${this.interval}s)`, (cx) => this.refresh(cx))
          .child(this.scanning ? svg(SPIN).size(12).flex_none().text_color(t.working).spin(900) : div().flex_none().text_size(14).text_color(t.muted).child("↻")))
        .child(this.iconButton(t, "fav-add", "Add a favorite port", (cx) => this.edit({ kind: "fav" }, cx))
          .child(svg(PLUS).size(11).flex_none().text_color(t.muted))
          .child(div().flex_none().text_size(12).text_color(this.star(t)).child("★"))))
      .child(div().flex_1().min_h(0).relative()
        .child(v_virtual_list("portal-list", items.length, items.map((it) => H[it.kind]), (i) => items[i]?.id ?? String(i),
          (r) => items.slice(r.start, r.end).map((it, j) => this.rowEl(t, it, r.start + j === at, r.start + j, shares)))
          .track_scroll(this.scroll).on_item_click((key, cx) => this.clicked(key, cx)).size_full())
        .child(Scrollbar.vertical("portal-list").viewport_from_layout().absolute().inset_0()))
      .when(!!strip, (el) => el.child(/** @type {any} */ (strip)))
      // A line above the key hints, so they do not read as more list rows.
      .child(divider(t))
      .child(legend(t, [["j/k", "move"], ["space", "expand"], ["enter", "open"], ["f", "favorite"], ["n", "add"], ["e", "URL"], ["x", "end"],
        ["c", "copy"], ["t/u/m/a", "filters"], ["/", "search"], ["p", "ports"], ["s", "sort"], ["r", "refresh"]]));
  }
}
