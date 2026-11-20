// keybinds: a dialog that lists every key in keys.json, grouped by what the keys act on.
// The filter box always has the keyboard, so typing narrows the list at once.
//
// Keys: up/down or ctrl-k/ctrl-j move through the rows, which scrolls the list.
// esc clears the filter, then closes. Each is also a command: `herdr-app do keybinds.<command>`.
//
// The rows come from keys.json itself, so a key bound with named arguments shows them.
// Until the file is read, and if it cannot be read, the rows come from the app's keys().

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, ScrollHandle } from "gpui-base";
import { keys, props, closeOverlay, nextCommand, appHome, readTextFile } from "herdr";
import { colors, SIZE } from "./kit/theme.js";
import { frame, divider } from "./kit/frame.js";
import { legend } from "./kit/legend.js";
import { listRow, listNote } from "./kit/list.js";
import { sectionLabel, tag } from "./kit/pane.js";
import { textInput } from "./kit/controls.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */

/**
 * One key from keys.json. `section` is where it applies ("global", "terminal", "layout:<name>",
 * "mod:<name>"). `action` is the command with its short argument ("pane.go:left").
 * `args` are the named arguments of a key written as an object.
 * @typedef {{ section: string, keys: string, action: string, args?: Record<string, unknown> }} Binding
 */

/**
 * One line of the list: every key that does the same thing, and what that is.
 * @typedef {{ group: string, section: string, keys: string[], label: string, search: string }} Row
 */

/** The groups in the order shown, each with the actions it holds. The last one takes the rest. */
const GROUPS = /** @type {[string, RegExp][]} */ ([
  ["Mods", /^mod\.open/],
  ["Spaces", /^space\./],
  ["Tabs", /^tab\./],
  ["Panes", /^pane\./],
  ["Agents", /^agent\./],
  ["Terminal", /^terminal(\.|$)|^send:/],
  ["Layout", /^layout\./],
  ["App", /./],
]);

/** The space between two rows. */
const ROW_GAP = 2;
/** The filter box is focused again this long after the dialog opens, once the app has put the keyboard on it. */
const REFOCUS_MS = 600;

/**
 * Reads keys.json's text into bindings. Returns null when the text is not the expected shape.
 * @param {string | null} text @returns {Binding[] | null}
 */
function parseKeys(text) {
  if (!text) return null;
  let file;
  try { file = JSON.parse(text); } catch { return null; }
  if (!file || typeof file !== "object") return null;
  /** @type {Binding[]} */
  const out = [];
  for (const [section, binds] of Object.entries(file)) {
    if (!binds || typeof binds !== "object") continue;
    for (const [combo, action] of Object.entries(binds)) {
      if (typeof action === "string") out.push({ section, keys: combo, action });
      else if (action && typeof action.command === "string") out.push({ section, keys: combo, action: action.command, args: action.args ?? {} });
    }
  }
  return out;
}

/** What a binding does, in words: "pane.go:left" reads "pane go left". @param {Binding} b */
function labelOf(b) {
  if (b.action.startsWith("send:")) return "type " + JSON.stringify(b.action.slice(5));
  if (b.action === "terminal") return "pass the key to the program";
  const at = b.action.indexOf(":");
  const name = at < 0 ? b.action : b.action.slice(0, at);
  // A key that opens a mod reads best with the mod's name: "open jump", "pane split right tourist".
  const words = name === "mod.open" ? "open" : name.replace(/[._]/g, " ");
  const values = at < 0 ? [] : [b.action.slice(at + 1)];
  for (const v of Object.values(b.args ?? {})) values.push(typeof v === "string" ? v : JSON.stringify(v));
  return [words, ...values].join(" ");
}

/** The group a binding is listed under. A key that puts a mod in a pane counts as a mod key. @param {Binding} b */
function groupOf(b) {
  if (b.args && typeof b.args.mod === "string") return "Mods";
  return (GROUPS.find(([, re]) => re.test(b.action)) ?? GROUPS[GROUPS.length - 1])[0];
}

/**
 * Turns bindings into rows, in group order. Keys that do the same thing share a row.
 * A run of numbered keys ("alt-1" to "alt-9" selecting spaces 1 to 9) becomes one row.
 * @param {Binding[]} bindings @returns {Row[]}
 */
function rowsOf(bindings) {
  /** @type {Map<string, Row & { digits: string[] }>} */
  const byId = new Map();
  for (const b of bindings) {
    let label = labelOf(b);
    let combo = b.keys;
    let digit = "";
    // "alt-3" bound to "space.select:3": the same digit ends the key and the action.
    const numbered = /^(.*\D)(\d)$/.exec(b.keys);
    if (numbered && !b.args && b.action.endsWith(":" + numbered[2])) {
      digit = numbered[2];
      combo = numbered[1] + "#";
      label = label.slice(0, -1) + "#";
    }
    const id = `${b.section}\n${label}${digit ? "\n" + combo : ""}`;
    const row = byId.get(id);
    if (row) {
      if (digit) row.digits.push(digit);
      else row.keys.push(combo);
    } else {
      byId.set(id, { group: groupOf(b), section: b.section, keys: [combo], label, search: "", digits: digit ? [digit] : [] });
    }
  }
  const rows = [...byId.values()].map((row) => {
    if (row.digits.length) {
      const digits = row.digits.slice().sort();
      const span = digits.length > 1 ? `${digits[0]}…${digits[digits.length - 1]}` : digits[0];
      row.keys = row.keys.map((k) => k.replace("#", span));
      row.label = row.label.replace("#", span);
    }
    row.search = [row.group, row.section, row.label, ...row.keys].join(" ").toLowerCase();
    return row;
  });
  const order = GROUPS.map(([name]) => name);
  // The sort is stable, so rows keep keys.json's order inside a group.
  return rows.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

export default class Keybinds extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    /** @type {Row[]} */
    this.rows = rowsOf(keys());
    /** @type {number} the selected row */
    this.at = 0;
    this.handle = cx.focus_handle();
    /** The filter box. It keeps the keyboard, and its keys reach the frame's key handler. */
    this.filter = InputState.new({ value: String(props()?.filter ?? ""), placeholder: "Filter by key or action" });
    this.filter.on("change", (_e, cx) => { this.select(0); cx.notify(); });
    this.filter.focus();
    cx.timer.after(REFOCUS_MS, () => this.filter.focus());
    /** The list's scroll position, so the selected row stays in view. */
    this.scroll = ScrollHandle.new();
    /** True after the selection moves, until the next render scrolls to it. */
    this.reveal = false;
    cx.spawn(async (cx) => {
      /** @type {string | null} */
      let text = null;
      try { text = await readTextFile(`${appHome()}/keys.json`); } catch { /* keep the rows from keys() */ }
      const found = parseKeys(text);
      if (!found) return;
      this.rows = rowsOf(found);
      cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.filter.focus();
        else if (c) this.command(c);
        cx.notify();
      }
    });
  }

  /** Closes the dialog. Placed as a layout block there is nothing to close. */
  close() {
    const overlay = props()?.overlay;
    if (overlay !== undefined) closeOverlay(overlay);
  }

  /** The rows that match every word in the filter box. @returns {Row[]} */
  shown() {
    const words = this.filter.value().toLowerCase().split(/\s+/).filter(Boolean);
    return this.rows.filter((row) => words.every((w) => row.search.includes(w)));
  }

  /** Selects row `i` and scrolls it into view on the next render. @param {number} i */
  select(i) {
    this.at = i;
    this.reveal = true;
  }

  /** @param {string} c "up", "down" or "cancel" */
  command(c) {
    const count = this.shown().length;
    if (c === "down" && count) this.select((this.at + 1) % count);
    else if (c === "up" && count) this.select((this.at - 1 + count) % count);
    else if (c === "cancel") {
      if (this.filter.value()) { this.filter.set_value(""); this.select(0); }
      else this.close();
    }
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    // Ctrl with j or k is read from the key and its modifiers, so it moves however the app spells the keystroke.
    const m = e.modifiers;
    const ctrlOnly = m.control && !m.shift && !m.alt && !m.platform;
    const c = ctrlOnly && e.key === "j" ? "down" : ctrlOnly && e.key === "k" ? "up"
      : e.keystroke === "down" ? "down" : e.keystroke === "up" ? "up" : e.keystroke === "escape" ? "cancel" : "";
    if (!c) return;
    this.command(c);
    cx.notify();
    cx.stop_propagation();
  }

  /** @param {Context} _cx */
  render(_cx) {
    const t = colors();
    const rows = this.shown();
    this.at = Math.max(0, Math.min(this.at, rows.length - 1));
    // The list's children: a label over each group, then its rows.
    /** @type {any[]} */
    const children = [];
    let selectedChild = 0;
    rows.forEach((row, i) => {
      if (i === 0 || rows[i - 1].group !== row.group) children.push(sectionLabel(t, row.group));
      if (i === this.at) selectedChild = children.length;
      children.push(listRow(t, { id: `keybind-${i}`, on: i === this.at, compact: true, click: (cx) => { this.select(i); cx.notify(); } })
        .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(row.label))
        .when(row.section !== "global", (el) => el.child(div().flex_none().text_size(SIZE.small).text_color(t.dim).child(row.section)))
        .children(row.keys.map((k) => tag(t, k))));
    });
    if (this.reveal && rows.length) {
      // The first row scrolls to its group's label, so the label is not left above the view.
      this.scroll.scroll_to_item(this.at === 0 ? 0 : selectedChild);
      this.reveal = false;
    }
    const details = div().flex_1().min_w(0).truncate().text_size(SIZE.small).text_color(t.dim)
      .child(rows.length === this.rows.length ? `${rows.length} shown` : `${rows.length} of ${this.rows.length} shown`);
    const list = v_flex().id("keybinds-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).gap(ROW_GAP);

    return frame(t, { id: "keybinds", title: "Keybinds", handle: this.handle, onKey: (e, cx) => this.key(e, cx), fill: true, details })
      .child(textInput(t, this.filter).flex_none())
      .child(rows.length ? list.children(children) : list.child(listNote(t, this.rows.length ? "No key matches" : "keys.json has no keys")))
      .child(divider(t))
      .child(legend(t, [["↑/↓", "move"], ["ctrl-j/k", "move"], ["esc", "clear, then close"]]));
  }
}
