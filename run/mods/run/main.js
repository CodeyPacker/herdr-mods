// run: mprocs, but as a herdr popup. Put a herdr.procs.json in your repo root
// and this runs each entry as a headless herdr-core terminal you can start,
// stop, restart and peek at without leaving the keyboard.
//
//   { "procs": [ { "name": "web", "cmd": "npm run dev", "cwd": "app", "autostart": true,
//                  "key": "w", "env": { "PORT": "3000" } } ] }
//
// `key` is the hint letter for that row. Space letters live in
// ~/.config/herdr-app/hints.json. Commands go through PowerShell on Windows
// and whatever $SHELL is elsewhere.
//
// Keys: hint letter picks a row, j/k move. s start, x stop, r restart, u start
// all the autostart ones, shift-x stop everything in the space, enter peeks
// at output, o turns it into a tab, a toggles every space, esc closes.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, terminals, machines, focused, run, hc, exec, notify, props, closeOverlay, openOverlay, shared, window as win, readTextFile, appHome, nextCommand } from "herdr";
import { colors, hints, tile, header, navigate, spaceColor, hintLine, guide, isHelpKey, readHintConfig, ROW_H } from "./tiles.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("gpui-kit").FocusHandle} FocusHandle */
/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {import("herdr").PaneInfo} PaneInfo */
/** @typedef {import("herdr").ExecResult} ExecResult */
/** @typedef {import("./tiles.js").HintConfig} HintConfig */
/** @typedef {{ name: string, cmd: string, cwd: string, autostart: boolean, key: string | null, env: Record<string, string> | null }} Proc */
/** @typedef {{ root: string | null, procs: Proc[] | null, error?: string }} Config */
/** @typedef {{ state: string, exit_code: number | null, reason: string | null }} Fin */
/** @typedef {{ address: string, state: string, exit_code?: number | null, reason?: string | null, pid?: number, labels?: Record<string, string> }} Term */
/** @typedef {{ kind: "space", s: SpaceInfo, cfg: Config | undefined, hint?: string, pinned?: boolean }} SpaceItem */
/** @typedef {{ kind: "proc", s: SpaceInfo, p: Proc, t: Term | null, key: string, state: "stopped" | "running" | "exited", detail: string, busy: string | undefined, hint?: string, pinned?: boolean }} ProcItem */
/** @typedef {SpaceItem | ProcItem} Item */
/** @typedef {{ address: string, name: string, space: string, spaceName: string }} Peek */

/** @type {{ intro: string, rows: [string, string][] }} */
const GUIDE = {
  intro: "Your repo's herdr.procs.json, running in the background. Its commands run as you, so trust the repo.",
  rows: [
    ["letter", "pick a process. Colored letters are yours."],
    ["j  k", "move"],
    ["s  x  r", "start, stop, restart"],
    ["u", "start everything marked autostart"],
    ["enter", "watch its output"],
    ["o", "give it a tab"],
    ["a", "show every space"],
  ],
};

const FILE = "herdr.procs.json";
const LABEL_SPACE = "run.space";
const LABEL_NAME = "run.name";
// These do things, so they can't be hints.
const RESERVED = "sxruoaqjk";
const STOP_WAIT_MS = 10000;

/**
 * Where the space is right now: its first pane's cwd, falling back to where it was created.
 * @param {SpaceInfo} s @param {PaneInfo[]} ps
 * @returns {string | null}
 */
function folderOf(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder || null;
}

/** @param {string} path @returns {string | null} */
function parent(path) {
  const m = path.replace(/[\\/]+$/, "").match(/^(.*)[\\/][^\\/]+$/);
  return m ? m[1] || null : null;
}

/** @param {string} base @param {string} rel */
function join(base, rel) {
  if (!rel) return base;
  if (/^([A-Za-z]:|\/|\\)/.test(rel)) return rel;
  const sep = base.includes("\\") ? "\\" : "/";
  return base.replace(/[\\/]+$/, "") + sep + rel;
}

// Names end up in hc labels, our own keys and shell variables, so keep them boring.
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const ENV_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SHELL_CACHE_MS = 24 * 3600 * 1000;

/**
 * Which shell runs the commands. pwsh if it's installed, otherwise the old
 * powershell.exe; on mac/linux your $SHELL, or sh. Probing spawns a process,
 * so we remember the answer for a day.
 * @returns {Promise<string[]>}
 */
async function findShell() {
  try {
    const cached = JSON.parse(localStorage.getItem("shell") ?? "null");
    if (cached && Date.now() - cached.at < SHELL_CACHE_MS && Array.isArray(cached.argv)) return cached.argv;
  } catch {}
  /** @type {string[]} */
  let argv;
  if (win()?.platform === "windows") {
    const ok = await exec("pwsh", ["-NoLogo", "-Command", "exit 0"]).then((r) => r.code === 0, () => false);
    argv = [ok ? "pwsh" : "powershell.exe", "-NoLogo", "-Command"];
  } else {
    const sh = await exec("sh", ["-c", "echo $SHELL"]).then((r) => r.stdout.trim(), () => "");
    argv = [sh || "sh", "-c"];
  }
  localStorage.setItem("shell", JSON.stringify({ at: Date.now(), argv }));
  return argv;
}

/**
 * Parse the file and complain early. Names and env keys have to be plain
 * identifiers because they get pasted into labels and shell commands.
 * @param {string} text
 * @returns {Proc[]}
 */
function parseProcs(text) {
  const json = JSON.parse(text);
  const list = Array.isArray(json) ? json : json.procs;
  if (!Array.isArray(list)) throw new Error('expected { "procs": [...] }');
  /** @type {Set<string>} */
  const seen = new Set();
  return list.map((p, i) => {
    if (!p?.name || !p?.cmd) throw new Error(`procs[${i}] needs name and cmd`);
    const name = String(p.name);
    if (!NAME_RE.test(name)) throw new Error(`procs[${i}].name "${name}": letters, digits, _ . - only`);
    if (seen.has(name)) throw new Error(`procs[${i}].name "${name}" is used twice`);
    seen.add(name);
    if (p.env != null && (typeof p.env !== "object" || Array.isArray(p.env))) throw new Error(`procs[${i}].env must be an object`);
    for (const k of Object.keys(p.env ?? {})) if (!ENV_RE.test(k)) throw new Error(`procs[${i}].env "${k}" is not a variable name`);
    return { name, cmd: String(p.cmd), cwd: p.cwd ? String(p.cwd) : "", autostart: p.autostart !== false, key: p.key ? String(p.key) : null, env: p.env ?? null };
  });
}

/**
 * Prefix the command with its env vars, quoted the way that shell wants.
 * @param {string[]} shell @param {string} cmd @param {Record<string, string> | null} env
 */
function withEnv(shell, cmd, env) {
  const pairs = Object.entries(env ?? {});
  if (!pairs.length) return cmd;
  const ps = shell[0].toLowerCase().includes("powershell") || shell[0].toLowerCase().startsWith("pwsh");
  /** @param {string} v */
  const quote = (v) => (ps ? `'${String(v).replace(/'/g, "''")}'` : `'${String(v).replace(/'/g, "'\\''")}'`);
  const set = pairs.map(([k, v]) => (ps ? `$env:${k}=${quote(v)};` : `export ${k}=${quote(v)};`)).join(" ");
  return `${set} ${cmd}`;
}

/** A rejected call reads as nothing. @returns {null} */
const none = () => null;

/** @param {unknown} e */
const errorText = (e) => (e instanceof Error ? e.message : String(e));

export default class Procs extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    /** @type {FocusHandle} */
    this.handle = cx.focus_handle();
    // If we were opened as the bar above a peeked terminal, that's all we are. No timers, no sweeps.
    /** @type {Peek | null} */
    this.peeked = props()?.peek ?? null;
    if (this.peeked) {
      this.handle.focus();
      cx.timer.after(300, () => this.handle.focus());
      return;
    }
    /** @type {number | null} the first process row, once there is one */
    this.at = null;
    /** @type {string} */
    this.typed = "";
    this.all = localStorage.getItem("all") === "1";
    /** @type {Record<string, Config>} by space id */
    this.configs = {};
    /** @type {Record<string, string>} "space/name" -> starting | stopping | restarting | won't stop */
    this.busy = {};
    this.note = "";
    // "space/name" -> the terminal address we started for it. terminals() only
    // knows live ones, so dead ones get looked up in hc ls --all by address.
    /** @type {Record<string, string>} */
    this.known = JSON.parse(localStorage.getItem("terms") ?? "{}");
    /** @type {Record<string, Fin>} by address, from hc ls --all */
    this.finished = {};
    /** @type {HintConfig} */
    this.hintConfig = { spaces: {}, tabs: {} };
    cx.spawn(async (cx) => { this.hintConfig = await readHintConfig(readTextFile, appHome); cx.notify(); });
    /** @type {string[] | null} */
    this.shell = null;
    cx.spawn(async (cx) => { this.shell = await findShell(); cx.notify(); });
    // Show the guide on the first run only. ? or the help button brings it back.
    this.showGuide = localStorage.getItem("seen") !== "1";
    localStorage.setItem("seen", "1");
    /** @type {Set<string>} addresses seen live at the last refresh, for the exit toast */
    this.wasLive = new Set();
    this.handle.focus();
    cx.timer.after(600, () => this.handle.focus());
    this.reload(cx);
    this.refresh(cx);
    cx.timer.every(2000, (cx) => this.refresh(cx));
    this.sweep(cx);
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "stopall") await this.stopAll(cx);
        else if (c === "up") await this.up(cx);
        else if (c === "peek") this.peek(this.items()[this.at ?? 0]);
        else if (c === "all") { this.all = !this.all; localStorage.setItem("all", this.all ? "1" : "0"); this.at = null; this.reload(cx); }
        else if (c === "focus") this.handle.focus();
        cx.notify();
      }
    });
  }

  close() {
    closeOverlay(props().overlay);
  }

  /**
   * Load herdr.procs.json for each space we're showing, walking up from the
   * space's folder until we hit the repo root. All spaces load in parallel.
   * @param {Context} cx
   */
  reload(cx) {
    cx.spawn(async (cx) => {
      const ps = panes();
      await Promise.all(this.shownSpaces().map(async (s) => {
        let dir = folderOf(s, ps);
        /** @type {{ root: string, text: string } | null} */
        let found = null;
        for (let i = 0; dir && i < 8 && !found; i++) {
          const text = await readTextFile(join(dir, FILE), { on: s.machine }).catch(none);
          if (text !== null) found = { root: dir, text };
          else dir = parent(dir);
        }
        if (!found) { this.configs[s.id] = { root: folderOf(s, ps), procs: null }; return; }
        try {
          this.configs[s.id] = { root: found.root, procs: parseProcs(found.text) };
        } catch (e) {
          this.configs[s.id] = { root: found.root, procs: null, error: `${FILE}: ${errorText(e)}` };
        }
      }));
      cx.notify();
    });
  }

  /** @param {string} key @param {string | null} address */
  remember(key, address) {
    if (address) this.known[key] = address;
    else delete this.known[key];
    localStorage.setItem("terms", JSON.stringify(this.known));
  }

  /** Exit states of every core terminal, finished ones included. @param {Context} cx */
  refresh(cx) {
    cx.spawn(async (cx) => {
      const r = await hc(["ls", "--all", "--json"]).catch(none);
      if (r?.code !== 0) return;
      try {
        /** @type {Record<string, Fin>} */
        const next = {};
        for (const t of JSON.parse(r.stdout).terminals ?? []) next[t.address] = { state: t.state, exit_code: t.exit_code ?? null, reason: t.reason ?? null };
        this.finished = next;
        // Something was running last tick and isn't now, and we didn't kill it. Toast.
        /** @type {Record<string, string>} address -> "space/name" */
        const byAddress = Object.fromEntries(Object.entries(this.known).map(([k, a]) => [a, k]));
        for (const a of this.wasLive) {
          const f = next[a];
          if (!f || f.state === "live" || f.reason === "killed" || !byAddress[a]) continue;
          const name = byAddress[a].split("/").slice(1).join("/");
          notify({ title: `${name} exited ${f.exit_code ?? "?"}`, body: "Open Run to see its output or restart it.", level: "error", action: { name: "mod.open", args: { name: "run" } } });
        }
        this.wasLive = new Set(Object.entries(next).filter(([a, f]) => f.state === "live" && byAddress[a]).map(([a]) => a));
      } catch {}
      cx.notify();
    });
  }

  /**
   * Clean up processes whose space was closed. Only runs once every machine's
   * layout has loaded. If one is still loading or offline we just don't know
   * its spaces yet, and guessing wrong here kills someone's dev server.
   * @param {Context} cx
   */
  sweep(cx) {
    cx.spawn(async () => {
      const ms = machines();
      if (!ms.length || ms.some((m) => m.layout !== "ready")) return;
      const all = spaces();
      if (!all.length) return;
      const ids = new Set(all.map((s) => s.id));
      /** @param {string} address @param {boolean} live */
      const gone = async (address, live) => {
        if (live) await hc(["kill", address]).catch(() => {});
        await hc(["rm", address]).catch(() => {});
      };
      for (const t of /** @type {Term[]} */ (terminals())) {
        const sid = t.labels?.[LABEL_SPACE];
        if (sid && !ids.has(sid)) await gone(t.address, t.state === "live");
      }
      for (const [key, address] of Object.entries(this.known)) {
        if (ids.has(key.split("/")[0])) continue;
        await gone(address, false);
        this.remember(key, null);
      }
    });
  }

  shownSpaces() {
    const all = spaces();
    return this.all ? all : all.filter((s) => s.active);
  }

  /**
   * Find the terminal for a process. A live one matches by label; a dead one is
   * whatever address we remembered starting.
   * @param {string} sid @param {string} name @param {Term[]} live terminals(), read once by the caller
   * @returns {Term | null}
   */
  termOf(sid, name, live) {
    const t = live.find((t) => t.labels?.[LABEL_SPACE] === sid && t.labels?.[LABEL_NAME] === name && t.state === "live");
    if (t) return t;
    const address = this.known[`${sid}/${name}`];
    const f = address && this.finished[address];
    return f ? { address, ...f } : null;
  }

  /** Every hinted thing in order: a header per space, then its rows. @returns {Item[]} */
  items() {
    /** @type {Item[]} */
    const out = [];
    const live = /** @type {Term[]} */ (terminals());
    for (const s of this.shownSpaces()) {
      const cfg = this.configs[s.id];
      out.push({ kind: "space", s, cfg });
      for (const p of cfg?.procs ?? []) {
        const t = this.termOf(s.id, p.name, live);
        const key = `${s.id}/${p.name}`;
        const busy = this.busy[key];
        /** @type {ProcItem["state"]} */
        let state = "stopped";
        let detail = "not started";
        if (t?.state === "live") { state = "running"; detail = `running · pid ${t.pid ?? "?"}`; }
        else if (t) { state = "exited"; detail = `exited ${t.exit_code ?? "?"}${t.reason === "killed" ? " (stopped)" : ""}`; }
        if (busy) detail = busy;
        out.push({ kind: "proc", s, p, t, key, state, detail, busy });
      }
    }
    const wanted = out.map((it) => (it.kind === "space" ? this.hintConfig.spaces[it.s.name] : it.p.key));
    const hs = hints(out.length, RESERVED, wanted);
    out.forEach((it, i) => { it.hint = hs[i]; it.pinned = !!wanted[i] && hs[i] === String(wanted[i]).toLowerCase(); });
    return out;
  }

  // Actions

  /** @param {Context} cx @param {ProcItem} it */
  async start(cx, it) {
    const cfg = this.configs[it.s.id];
    if (!cfg?.root) return;
    this.busy[it.key] = "starting";
    cx.notify();
    if (!this.shell) this.shell = await findShell();
    if (it.t && it.t.state !== "live") await hc(["rm", it.t.address]).catch(() => {});
    const args = ["run", "--bg", "--no-parent", "--outlive-parent",
      "--label", `${LABEL_SPACE}=${it.s.id}`, "--label", `${LABEL_NAME}=${it.p.name}`,
      "--cwd", join(cfg.root, it.p.cwd)];
    if (it.s.machine) args.push("--on", it.s.machine);
    /** @type {ExecResult} */
    const r = await hc([...args, "--json", "--", ...this.shell, withEnv(this.shell, it.p.cmd, it.p.env)]).catch((e) => ({ code: 1, stdout: "", stderr: errorText(e) }));
    delete this.busy[it.key];
    if (r.code !== 0) this.note = `start ${it.p.name}: ${(r.stderr || r.stdout || "").trim()}`;
    else {
      try { this.remember(it.key, JSON.parse(r.stdout).address); } catch {}
    }
    this.refresh(cx);
    cx.notify();
  }

  /** @param {Context} cx @param {ProcItem} it @returns {Promise<boolean>} true once it has stopped */
  async stop(cx, it) {
    if (!it.t || it.t.state !== "live") return false;
    this.busy[it.key] = "stopping";
    cx.notify();
    await hc(["kill", it.t.address]).catch(() => {});
    const t0 = Date.now();
    while (Date.now() - t0 < STOP_WAIT_MS) {
      const r = await hc(["get", it.t.address, "--json"]).catch(none);
      let state = "finished";
      try { state = JSON.parse(r?.stdout ?? "{}").state ?? "finished"; } catch {}
      if (state !== "live") { delete this.busy[it.key]; this.remember(it.key, it.t.address); this.refresh(cx); return true; }
      await new Promise((ok) => cx.timer.after(250, () => ok(null)));
    }
    this.busy[it.key] = "won't stop";
    cx.notify();
    return false;
  }

  /** @param {Context} cx @param {ProcItem} it */
  async restart(cx, it) {
    if (it.t?.state === "live") {
      this.busy[it.key] = "restarting";
      if (!(await this.stop(cx, it))) return;
      const fresh = this.items().find((x) => x.kind === "proc" && x.key === it.key);
      if (fresh?.kind === "proc") it = fresh;
    }
    await this.start(cx, it);
  }

  /** Starts every autostart process that isn't running. @param {Context} cx */
  async up(cx) {
    for (const it of this.items()) {
      if (it.kind === "proc" && it.p.autostart && it.state !== "running" && !this.busy[it.key]) await this.start(cx, it);
    }
  }

  /** @param {Context} cx */
  async stopAll(cx) {
    for (const it of this.items()) if (it.kind === "proc" && it.state === "running") await this.stop(cx, it);
  }

  /**
   * Show the process output in our own dialog: a little bar with the keys on
   * top, the terminal underneath. Herdr's built-in peek had no way to tell you
   * how to get out, so this one does.
   * @param {Item | undefined} it
   */
  peek(it) {
    if (it?.kind !== "proc") return;
    if (it.t?.state !== "live") { this.note = `${it.p.name} is not running`; return; }
    /** @type {Peek} */
    const peek = { address: it.t.address, name: it.p.name, space: it.s.id, spaceName: it.s.name };
    // Order matters. Closing the popup tears this mod instance down, so anything
    // we call after close() silently never happens.
    openOverlay({
      kind: "dialog", width: 0.85, height: 0.8,
      layout: { type: "column", children: [
        { type: "block", size: { px: 32 }, content: { mod: "run", props: { peek } } },
        { type: "block", content: { terminal: it.t.address } },
      ] },
    });
    this.close();
  }

  /** The bar over a peeked terminal. @param {KeyEvent} e @param {Context} cx */
  barKey(e, cx) {
    const k = e.keystroke;
    const p = this.peeked;
    if (k === "escape" || k === "q") closeOverlay(props().overlay);
    else if (k === "o") {
      closeOverlay(props().overlay);
      if (focused()?.space !== p.space) run("space.select", { id: p.space });
      run("terminal.keep", { terminal: p.address, place: "tab" });
    } else if (k === "b") {
      closeOverlay(props().overlay);
      run("mod.open", { name: "run" });
    } else return;
    cx.stop_propagation();
  }

  renderBar() {
    const t = colors();
    const p = this.peeked;
    const live = /** @type {Term[]} */ (terminals()).find((x) => x.address === p.address);
    const state = live?.state === "live" ? `running · pid ${live.pid ?? "?"}` : "ended";
    return h_flex()
      .id("run-bar")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.barKey(e, cx))
      .on_click(() => this.handle.focus())
      .w_full()
      .h_full()
      .px(12)
      .gap(10)
      .items_center()
      .bg(t.chrome)
      .border_b(1)
      .border_color(t.border)
      .text_size(12)
      .child(div().w(8).h(8).rounded(4).flex_none().bg(live?.state === "live" ? t.ansi2 : t.ansi1))
      .child(div().flex_none().font_semibold().text_color(t.foreground).child(p.name))
      .child(div().flex_none().text_color(t.dim).child(`${p.spaceName} · ${state}`))
      .child(div().flex_1())
      .child(hintLine(t, [["esc", "close"], ["o", "keep as tab"], ["b", "back to list"]]))
      .child(div().flex_none().text_size(11).text_color(t.dim).child("click the output to type in it, the bar to get these keys back"));
  }

  /** Gives the process a tab of its own. @param {ProcItem} it */
  keep(it) {
    if (it.t?.state !== "live") { this.note = `${it.p.name} is not running`; return; }
    this.close();
    if (!it.s.active) run("space.select", { id: it.s.id });
    run("terminal.keep", { terminal: it.t.address, place: "tab" });
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    const items = this.items();
    /** @type {import("./tiles.js").NavState} */
    const state = { at: this.at ?? 0, typed: this.typed };
    const r = navigate(state, e, items);
    this.at = state.at;
    this.typed = state.typed;
    this.note = "";
    if (r === "close") { this.close(); cx.stop_propagation(); return; }
    if (isHelpKey(e)) {
      this.showGuide = !this.showGuide;
      cx.stop_propagation();
      cx.notify();
      return;
    }
    if (r === "hit" && items[this.at]?.kind === "space") {
      // Typing a space's letter selects its first process, not the header.
      const next = items[this.at + 1];
      if (next?.kind === "proc") this.at++;
    }
    if (r === "act") this.peek(items[this.at]);
    if (r) { cx.stop_propagation(); cx.notify(); return; }
    if (e.modifiers.control || e.modifiers.alt || e.modifiers.platform) return;
    const it = items[this.at];
    const proc = it?.kind === "proc" ? it : null;
    const k = e.keystroke;
    if (k === "a") { this.all = !this.all; localStorage.setItem("all", this.all ? "1" : "0"); this.at = null; this.reload(cx); }
    else if (k === "u") cx.spawn((cx) => this.up(cx));
    else if (k === "q") this.close();
    else if (k === "shift-x") {
      const s = it?.s;
      const n = items.filter((x) => x.kind === "proc" && x.s === s && x.state === "running").length;
      if (s && n) openOverlay({ mod: "confirm", kind: "dialog", width: 380, props: { title: `Stop ${n} process${n > 1 ? "es" : ""} in ${s.name}?`, detail: "Each one is killed. Their output stays until started again.", command: { name: "run.stopall", args: {} } } });
    }
    else if (!proc) return;
    // Ignore s/x/r while something's already happening to that row.
    else if (k === "s") { if (proc.state !== "running" && !proc.busy) cx.spawn((cx) => this.start(cx, proc)); }
    else if (k === "x") { if (!proc.busy) cx.spawn((cx) => this.stop(cx, proc)); }
    else if (k === "r") { if (!proc.busy) cx.spawn((cx) => this.restart(cx, proc)); }
    else if (k === "o") this.keep(proc);
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  /** @param {Context} cx */
  render(cx) {
    if (this.peeked) return this.renderBar();
    const t = colors();
    const items = this.items();
    // Start on the first actual process, not a space header. If no config has
    // loaded yet there's nothing to land on, so leave it unset and try next render.
    if (this.at === null) {
      const i = items.findIndex((it) => it.kind === "proc");
      if (i >= 0) this.at = i;
    }
    const at = Math.max(0, Math.min(this.at ?? 0, items.length - 1));
    if (this.at !== null) this.at = at;
    const space = /** @type {Record<string, string> | undefined} */ (shared("space.colors"));
    // gpui elements are single-use, so collect each space's rows first and build the group after.
    /** @type {{ it: SpaceItem, i: number, empty: string | null, error: boolean, tiles: ReturnType<typeof tile>[] }[]} */
    const groups = [];
    items.forEach((it, i) => {
      const on = i === at;
      if (it.kind === "space") {
        const cfg = it.cfg;
        const running = items.filter((x) => x.kind === "proc" && x.s === it.s && x.state === "running").length;
        const auto = (cfg?.procs ?? []).filter((p) => p.autostart).length;
        /** @type {string | null} */
        let empty = null;
        if (cfg && !cfg.procs) empty = cfg.error ?? `no ${FILE} in ${cfg.root ?? "this space"}`;
        else if (cfg?.procs && !running && auto) empty = `nothing running · u starts ${auto}`;
        else if (cfg?.procs?.length === 0) empty = `${FILE} declares no procs`;
        groups.push({ it, i, empty, error: !!cfg?.error, tiles: [] });
        return;
      }
      groups[groups.length - 1].tiles.push(tile(t, {
        id: `p-${it.key}`, hint: it.hint ?? "", typed: this.typed, pinned: it.pinned, on, status: it.busy ? "working" : it.state,
        title: it.p.name, detail: it.detail,
        onClick: (_e, cx) => { this.at = i; cx.notify(); },
      }));
    });
    const sections = groups.map(({ it, i, empty, error, tiles }) =>
      v_flex().gap(2)
        .child(header(t, { id: `h-${it.s.id}`, hint: it.hint ?? "", typed: this.typed, pinned: it.pinned, name: it.s.name, color: spaceColor(t, it.s, space), onClick: (_e, cx) => { this.at = i + 1 < items.length && items[i + 1].kind === "proc" ? i + 1 : i; cx.notify(); } }))
        .when(!!empty, (el) => el.child(div().pl(26).pb(4).text_size(11).text_color(error ? t.blocked : t.dim).child(empty ?? "")))
        .children(tiles),
    );
    if (!items.length) sections.push(div().text_color(t.dim).child("no spaces"));
    // The popup sizes to content, so the scrollable list needs an explicit height or it collapses.
    const est = groups.reduce((h, g) => h + 30 + (g.empty ? 20 : 0) + g.tiles.length * (ROW_H + 2) + 8, 0) || 24;
    const listH = Math.min(520, est);

    return v_flex()
      .id("run")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .w_full()
      .min_h(0)
      .p(18)
      .gap(10)
      .bg(t.popover)
      .text_size(13)
      .child(
        h_flex().items_center().gap(10)
          .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child(this.all ? "Run · every space" : "Run"))
          .child(div().text_size(11).text_color(t.dim).child("Esc")),
      )
      .when(this.showGuide, (el) => el.child(guide(t, GUIDE)))
      .child(v_flex().id("run-list").h(listH).flex_none().overflow_y_scrollbar().gap(8).children(sections))
      .when(!!this.note, (el) => el.child(div().text_size(11).text_color(t.blocked).child(this.note)))
      .child(
        h_flex().items_end().gap(12)
          .child(div().flex_1().child(hintLine(t, [["j/k ctrl-n/p", "move"], ["s", "start"], ["x", "stop"], ["r", "restart"], ["u", "up all"], ["shift-x", "stop all"], ["enter", "peek"], ["o", "keep as tab"], ["a", this.all ? "this space" : "all spaces"]])))
          .child(
            h_flex().id("run-help").flex_none().items_center().gap(4).cursor_pointer().text_size(11)
              .on_click((_e, cx) => { this.showGuide = !this.showGuide; cx.notify(); })
              .child(div().text_color(t.accent).font_semibold().child("?"))
              .child(div().text_color(t.dim).child("help")),
          ),
      );
  }
}
