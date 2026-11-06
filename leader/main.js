// leader: a tmux-style prefix key for herdr. Bind something to `mod.open:leader`
// (ctrl-a if you're a tmux person), press it, then press one more key and it
// runs whatever ~/.config/herdr-app/leader.json says:
//
//   { "j": "mod.open:jump", "p": "mod.open:run", "c": "tab.new", "x": { "command": "pane.close", "args": {} } }
//
// Values look like keys.json actions: "name", "name:value", or { "command", "args" }.
// A little box lists the mappings while it waits. Esc, an unmapped key, or the
// leader key again all close it.
//
// Don't want the box? Wrap the keys and switch it off:
//
//   { "show": false, "keys": { "j": "mod.open:jump" } }
//
// leader.example.json next to this file only maps built-in commands. Copy it
// to ~/.config/herdr-app/leader.json and go from there.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, theme, props, closeOverlay, readTextFile, appHome, keys, commands } from "herdr";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("gpui-kit").FocusHandle} FocusHandle */
/** @typedef {import("gpui-kit").Color} Color */
/** @typedef {string | { command: string, args?: Record<string, unknown> }} Action */

const FILE = "leader.json";

/**
 * "mod.open:jump" -> ["mod.open", { name: "jump" }]; the first argument's name comes from the command.
 * @param {Action} action
 * @param {ReturnType<typeof commands>} cmds
 * @returns {[string, Record<string, unknown>]}
 */
function parse(action, cmds) {
  if (typeof action === "object") return [action.command, action.args ?? {}];
  const s = String(action);
  const i = s.indexOf(":");
  if (i < 0) return [s, {}];
  const name = s.slice(0, i);
  const value = s.slice(i + 1);
  const first = cmds.find((c) => c.name === name)?.args?.[0]?.name ?? "name";
  return [name, { [first]: /^\d+$/.test(value) ? Number(value) : value }];
}

/**
 * Drop any `mod.open:<name>` mapping whose mod isn't installed (no
 * mods/<name>/mod.json). Otherwise a shared leader.json advertises keys that
 * just throw an error toast.
 * @param {Record<string, Action>} map
 * @returns {Promise<Record<string, Action>>}
 */
async function installedOnly(map) {
  /** @type {Record<string, Action>} */
  const out = {};
  for (const [k, a] of Object.entries(map)) {
    const m = typeof a === "string" ? a.match(/^mod\.open:(.+)$/) : null;
    if (m) {
      const present = await readTextFile(`${appHome()}/mods/${m[1]}/mod.json`).catch(/** @returns {null} */ () => null);
      if (present === null) continue;
    }
    out[k] = a;
  }
  return out;
}

/** What a mapping reads as in the list. @param {Action} action */
function label(action) {
  if (typeof action === "object") return action.command;
  const s = String(action);
  return s.startsWith("mod.open:") ? s.slice(9) : s.replace(/^(\w+)\.(\w+)(:(.*))?$/, (_m, a, b, _c, d) => `${b.replace(/_/g, " ")} ${a}${d ? " " + d : ""}`);
}

export default class Leader extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    /** @type {Record<string, Action>} */
    this.map = {};
    this.error = "";
    // "show": false in the file means wait silently, nothing on screen.
    this.show = true;
    /** @type {FocusHandle} */
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(300, () => this.handle.focus());
    // Whatever key opened us. Pressing it again closes.
    this.leaderKey = keys().find((k) => k.action === "mod.open:leader")?.keys ?? null;
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(appHome() + "/" + FILE);
        if (text === null) this.error = `no ${FILE} in ${appHome()}`;
        else {
          const json = JSON.parse(text);
          // Two shapes: a flat key map, or { show, keys } when the box is turned off.
          const wrapped = json && typeof json.keys === "object" && json.keys !== null;
          this.show = !(wrapped && json.show === false);
          this.map = await installedOnly(wrapped ? json.keys : json);
        }
      } catch (e) {
        this.error = `${FILE}: ${e instanceof Error ? e.message : String(e)}`;
      }
      cx.notify();
    });
  }

  close() {
    closeOverlay(props().overlay);
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    cx.stop_propagation();
    const k = e.keystroke;
    if (k === "escape" || k === this.leaderKey) return this.close();
    if (k === "shift" || k === "ctrl" || k === "alt" || k === "cmd") return;
    const action = this.map[k] ?? this.map[e.key];
    this.close();
    if (action === undefined) return;
    const [name, args] = parse(action, commands());
    run(name, args);
  }

  render() {
    const t = /** @type {Record<string, Color>} */ (theme());
    // Hidden mode: grab the keyboard, draw nothing. The overlay has no frame of its own so this really is invisible.
    if (!this.show && !this.error) {
      return div().id("leader").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx)).size(1);
    }
    const rows = Object.entries(this.map).map(([k, a]) =>
      h_flex().gap(10).items_center().h(24)
        .child(h_flex().flex_none().min_w(28).h(18).px(5).rounded(4).bg(t.raised).border_1().border_color(t.border).items_center().justify_center().text_size(11).font_semibold().text_color(t.accent).child(k))
        .child(div().flex_1().truncate().text_color(t.muted).child(label(a))),
    );
    return v_flex()
      .id("leader")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .w_full()
      .p(14)
      .gap(6)
      .rounded(10)
      .border_1()
      .border_color(t.border)
      .bg(t.popover)
      .text_size(13)
      .child(h_flex().items_center().child(div().flex_1().text_size(13).font_semibold().text_color(t.foreground).child(this.leaderKey ? `${this.leaderKey} …` : "leader …")).child(div().text_size(11).text_color(t.dim).child("Esc")))
      .when(!!this.error, (el) => el.child(div().text_size(11).text_color(t.blocked).child(this.error)))
      .when(!this.error && !rows.length, (el) => el.child(div().text_size(11).text_color(t.dim).child(`${FILE} maps no keys yet`)))
      .children(rows);
  }
}
