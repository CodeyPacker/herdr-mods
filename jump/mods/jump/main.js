// jump: tmux's prefix+w crossed with vimium. Every space and its tabs get a
// letter; type one and you're there. A space's letter takes you to its active
// tab. j/k or arrows move, enter goes, x closes the selected tab, t opens a new
// tab, n a new space, esc bails. Pick your own letters in
// ~/.config/herdr-app/hints.json (see tiles.js).

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, agents, run, props, closeOverlay, shared, readTextFile, appHome } from "herdr";
import { colors, hints, tile, header, navigate, spaceColor, hintLine, guide, isHelpKey, readHintConfig, ROW_H } from "./tiles.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("gpui-kit").FocusHandle} FocusHandle */
/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {import("herdr").TabInfo} TabInfo */
/** @typedef {import("./tiles.js").HintConfig} HintConfig */
/** @typedef {{ kind: "space", s: SpaceInfo, hint?: string, pinned?: boolean }} SpaceItem */
/** @typedef {{ kind: "tab", s: SpaceInfo, tab: TabInfo, who: string, status: string | null, hint?: string, pinned?: boolean }} TabItem */
/** @typedef {{ kind: "new-tab" | "new-space", hint: string, pinned?: boolean }} NewItem */
/** @typedef {SpaceItem | TabItem | NewItem} Item */

/** @type {{ intro: string, rows: [string, string][] }} */
const GUIDE = {
  intro: "Type a letter, land on that tab.",
  rows: [
    ["letter", "go there. A space's letter opens its active tab."],
    ["j  k", "move, then enter to go"],
    ["x", "close the selected tab"],
    ["t  n", "new tab here, new space"],
    ["", "Pick your own letters in ~/.config/herdr-app/hints.json. They show in color."],
  ],
};

// These do things, so they can't be hints.
const RESERVED = "tnqjkx";

export default class Jump extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    /** @type {number | null} null until the first render lands on the active tab */
    this.at = null;
    /** @type {string} */
    this.typed = "";
    /** @type {HintConfig} */
    this.hintConfig = { spaces: {}, tabs: {} };
    cx.spawn(async (cx) => { this.hintConfig = await readHintConfig(readTextFile, appHome); cx.notify(); });
    // Show the guide on the first run only. ? or the help button brings it back.
    this.showGuide = localStorage.getItem("seen") !== "1";
    localStorage.setItem("seen", "1");
    /** @type {FocusHandle} */
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(600, () => this.handle.focus());
  }

  close() {
    closeOverlay(props().overlay);
  }

  /** Every hinted thing in order: a header per space, its tabs, then the two new rows. @returns {Item[]} */
  items() {
    /** @type {Item[]} */
    const out = [];
    const ps = panes();
    const ag = agents();
    for (const s of spaces()) {
      out.push({ kind: "space", s });
      for (const tab of s.tabs ?? []) {
        const mine = ps.filter((p) => p.tab === tab.id);
        const who = mine.map((p) => p.mod ?? p.program?.name ?? "shell");
        const status = ag.filter((a) => a.tab === tab.id).map((a) => a.status);
        out.push({ kind: "tab", s, tab, who: [...new Set(who)].join(" · "), status: tab.status ?? status[0] ?? null });
      }
    }
    const wanted = out.map((it) => (it.kind === "space" ? this.hintConfig.spaces[it.s.name] : it.kind === "tab" ? this.hintConfig.tabs[`${it.s.name}/${it.tab.name}`] : null));
    const hs = hints(out.length, RESERVED, wanted);
    out.forEach((it, i) => { it.hint = hs[i]; it.pinned = !!wanted[i] && hs[i] === String(wanted[i]).toLowerCase(); });
    out.push({ kind: "new-tab", hint: "t" });
    out.push({ kind: "new-space", hint: "n" });
    return out;
  }

  /** Goes where the item points, then closes. @param {Item | undefined} it */
  go(it) {
    if (!it) return;
    this.close();
    if (it.kind === "tab") run("tab.select", { id: it.tab.id });
    else if (it.kind === "space") run("space.select", { id: it.s.id });
    else if (it.kind === "new-tab") run("tab.new");
    else if (it.kind === "new-space") run("space.new");
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    const items = this.items();
    /** @type {import("./tiles.js").NavState} */
    const state = { at: this.at ?? 0, typed: this.typed };
    const r = navigate(state, e, items);
    this.at = state.at;
    this.typed = state.typed;
    if (r === "close") { this.close(); cx.stop_propagation(); return; }
    if (isHelpKey(e)) {
      this.showGuide = !this.showGuide;
      cx.stop_propagation();
      cx.notify();
      return;
    }
    if (r === "hit" || r === "act") this.go(items[this.at]);
    if (r) { cx.stop_propagation(); cx.notify(); return; }
    const it = items[this.at];
    if (e.keystroke === "x" && it?.kind === "tab") {
      this.close();
      run("tab.close", { id: it.tab.id });
    } else if (e.keystroke === "q") this.close();
    else return;
    cx.stop_propagation();
  }

  /** @param {Context} cx */
  render(cx) {
    const t = colors();
    const items = this.items();
    // Start on the tab you're already in.
    if (this.at === null) this.at = Math.max(0, items.findIndex((it) => it.kind === "tab" && it.s.active && it.tab.active));
    this.at = Math.max(0, Math.min(this.at, items.length - 1));
    const at = this.at;
    const space = /** @type {Record<string, string> | undefined} */ (shared("space.colors"));
    // gpui elements are single-use, so collect each space's rows first and build the group after.
    /** @type {{ it: SpaceItem, tiles: ReturnType<typeof tile>[] }[]} */
    const groups = [];
    /** @type {ReturnType<typeof tile>[]} */
    const extras = [];
    items.forEach((it, i) => {
      const on = i === at;
      if (it.kind === "space") { groups.push({ it, tiles: [] }); return; }
      if (it.kind === "tab") {
        groups[groups.length - 1].tiles.push(tile(t, {
          id: `j-${it.tab.id}`, hint: it.hint ?? "", typed: this.typed, pinned: it.pinned, on, status: it.status,
          title: it.tab.name, detail: it.who || "empty",
          onClick: () => this.go(it),
        }));
        return;
      }
      extras.push(tile(t, {
        id: `j-${it.kind}`, hint: it.hint, typed: this.typed, on, status: null,
        title: it.kind === "new-tab" ? "new tab" : "new space", detail: it.kind === "new-tab" ? "in this space" : "on this computer",
        onClick: () => this.go(it),
      }));
    });
    const sections = groups.map(({ it, tiles }) =>
      v_flex().gap(2)
        .child(header(t, { id: `jh-${it.s.id}`, hint: it.hint ?? "", typed: this.typed, pinned: it.pinned, name: it.s.name, color: spaceColor(t, it.s, space), onClick: () => this.go(it) }))
        .children(tiles),
    );
    sections.push(v_flex().gap(2).pt(8).border_t(1).border_color(t.border).children(extras));
    // The popup sizes to content, so the scrollable list needs an explicit height or it collapses.
    const est = groups.reduce((h, g) => h + 30 + g.tiles.length * (ROW_H + 2) + 8, 0) + 2 * (ROW_H + 2) + 16;
    const listH = Math.min(560, est);

    return v_flex()
      .id("jump")
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
          .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Jump to…"))
          .child(div().text_size(11).text_color(t.dim).child("Esc")),
      )
      .when(this.showGuide, (el) => el.child(guide(t, GUIDE)))
      .child(v_flex().id("jump-list").h(listH).flex_none().overflow_y_scrollbar().gap(8).children(sections))
      .child(
        h_flex().items_end().gap(12)
          .child(div().flex_1().child(hintLine(t, [["letter", "go"], ["j/k ctrl-n/p", "move"], ["enter", "go"], ["t", "new tab"], ["n", "new space"], ["x", "close tab"]])))
          .child(
            h_flex().id("jump-help").flex_none().items_center().gap(4).cursor_pointer().text_size(11)
              .on_click((_e, cx) => { this.showGuide = !this.showGuide; cx.notify(); })
              .child(div().text_color(t.accent).font_semibold().child("?"))
              .child(div().text_color(t.dim).child("help")),
          ),
      );
  }
}
