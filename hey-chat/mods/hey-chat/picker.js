// The project list (⌃p): every chat tab in every space, in a popup over the window. Each row has
// a letter, as in the jump mod. Type it, or move with j/k and press enter, to go to that tab.
// The same popup asks which project when the shortcut has no folder to go on (openChooser): your
// Hey, chat projects, then "Quick chat" (not saved) and "Choose another folder…".
import { div } from "gpui-kit";
import { h_flex, v_flex, ScrollHandle } from "gpui-base";
import { props, closeOverlay, openOverlay } from "herdr";
import { colors, SIZE } from "./kit/theme.js";
import { frame, divider } from "./kit/frame.js";
import { hint } from "./kit/legend.js";
import { assignLetters, letterRow, navigateByLetter } from "./kit/letters.js";
import { statusDot } from "./kit/spaces.js";
import { chatTabs, showChatTab, toggle, openQuick } from "./tabs.js";
import { loadStore, expand, tilde } from "./store.js";
import { folderName, normalFolder } from "./common.js";
import { pickProject } from "./folders.js";
import { makeShortcuts } from "./shortcuts.js";

/** The popup's width, and the most rows it shows before the list scrolls. */
const WIDTH = 520, MOST_ROWS = 12;
/** The frame's title, legend and padding, around the rows. */
const CHROME = 118;

/** Opens the project list over the window. */
export function openPicker() {
  const rows = Math.max(1, Math.min(MOST_ROWS, chatTabs().length));
  openOverlay({ mod: "hey-chat", props: { projects: true }, kind: "dialog", frame: "none", width: WIDTH, height: CHROME + rows * (SIZE.compactRow + 2) });
}

/** Your Hey, chat projects, by name: { name, folder }, each folder once. */
async function knownProjects() {
  const { projects } = await loadStore();
  const seen = new Set();
  const out = [];
  for (const p of projects) {
    const folder = normalFolder(expand(String(p.path ?? "")));
    if (!folder || seen.has(folder.toLowerCase())) continue;
    seen.add(folder.toLowerCase());
    out.push({ name: folderName(folder), folder });
  }
  return out.sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
}

/** Opens the popup that asks which project a new chat is for. */
export async function openChooser() {
  const rows = Math.max(1, Math.min(MOST_ROWS, (await knownProjects()).length + 2));
  openOverlay({ mod: "hey-chat", props: { projects: true, choose: true }, kind: "dialog", frame: "none", width: WIDTH, height: CHROME + rows * (SIZE.compactRow + 2) });
}

/** The list's own state and drawing. The view hands it its keys and its render. */
export class Picker {
  /** @param {any} cx */
  constructor(cx) {
    this.at = -1;      // the selected row; -1 until the first render puts it on the current tab
    this.typed = "";
    this.shortcuts = makeShortcuts();
    this.scroll = ScrollHandle.new();
    this.handle = cx.focus_handle();
    this.handle.focus();
    // Asking which project: the list comes from the saved projects.
    this.choosing = Boolean(props()?.choose);
    /** @type {{ name: string, folder: string }[]} */
    this.projects = [];
    if (this.choosing) cx.spawn(async (/** @type {any} */ cx) => { this.projects = await knownProjects(); cx.notify(); });
    cx.timer.after(50, () => this.handle.focus());
  }

  release() { this.scroll.release(); this.shortcuts.scroll.release(); }

  close() { closeOverlay(props()?.overlay); }

  /** The rows, each with its letter. j and k move, so no row gets them. */
  items() {
    if (this.choosing) {
      const rows = [...this.projects,
        { name: "Quick chat", folder: "", note: "Not in a project. Its history is deleted when you close it.", quick: true },
        { name: "Choose another folder…", folder: "", other: true }];
      const letters = assignLetters(rows.length, "jk");
      return rows.map((row, i) => ({ ...row, tab: `choose-${i}`, current: false, hint: letters[i] }));
    }
    const tabs = chatTabs();
    const letters = assignLetters(tabs.length, "jk");
    return tabs.map((tab, i) => ({ ...tab, hint: letters[i] }));
  }

  /** @param {any} it @param {any} cx */
  go(it, cx) {
    if (!it) return;
    // A project: its chat tab opens (or shows), then the popup closes, as the shortcut's own copy does.
    if (this.choosing && it.quick) { this.close(); openQuick(); return; }
    if (this.choosing) {
      cx.spawn(async (/** @type {any} */ cx) => {
        try {
          const folder = it.other ? (await pickProject())?.cwd : it.folder;
          if (folder) await toggle(cx, folder);
        } finally { this.close(); }
      });
      return;
    }
    // Closed first: the dialog gives the keyboard back to where it was opened as it closes, which
    // would take it away from the tab shown next.
    this.close();
    showChatTab(it);
  }

  /** @param {import("gpui-kit").KeyEvent} e @param {any} cx */
  key(e, cx) {
    // Its own key closes it, so ⌃p opens and closes the list.
    if (this.shortcuts.matches("projects", e.keystroke)) { this.close(); cx.stop_propagation(); return; }
    const items = this.items();
    const state = { at: Math.max(0, this.at), typed: this.typed };
    const r = navigateByLetter(state, e, items);
    this.at = state.at;
    this.typed = state.typed;
    if (r === "close") this.close();
    else if (r === "hit" || r === "act") this.go(items[this.at], cx);
    else if (r === "done") this.scroll.scroll_to_item(this.at);
    if (r) { cx.stop_propagation(); cx.notify(); }
  }

  render() {
    const t = colors();
    const items = this.items();
    if (this.at < 0) this.at = Math.max(0, items.findIndex(it => it.current));
    this.at = Math.min(this.at, Math.max(0, items.length - 1));
    const rows = items.map((it, i) => letterRow(t, { id: `project-${it.tab}`, letters: it.hint ?? "", typed: this.typed, on: i === this.at, compact: true, click: (cx) => this.go(it, cx) })
      .child(div().flex_none().max_w(200).truncate().font_medium().text_color(t.foreground).child(it.name))
      .child(div().flex_1().min_w(0).truncate().text_size(SIZE.small).text_color(t.dim).child(it.note ?? (it.folder ? tilde(it.folder) : "")))
      .when(it.current, el => el.child(div().flex_none().text_size(SIZE.small).text_color(t.accent).child("here")))
      .when(!this.choosing, el => el.child(div().flex_none().max_w(140).truncate().text_size(SIZE.small).text_color(t.dim).child(it.spaceName))
        .child(statusDot(t, it.status))));
    const list = items.length
      ? v_flex().id("project-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).gap(2).children(rows)
      : div().flex_1().px(12).text_size(13).text_color(t.dim).child("No chat tabs are open.");
    return frame(t, { id: "projects", title: this.choosing ? "Which project?" : "Projects", handle: this.handle, onKey: (e, cx) => this.key(e, cx), fill: true })
      .child(list)
      .when(this.shortcuts.showHints, el => el.child(divider(t))
        .child(h_flex().flex_none().items_center().gap(12).text_size(SIZE.small)
          .child(hint(t, ["j/k", "move"])).child(hint(t, ["↵", "go"])).child(hint(t, ["a–z", "jump"]))));
  }
}
