import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { spaces, panes, agents, run, props, closeOverlay, readTextFile, appHome, home } from "herdr";
import { colors, panelFill, hints, row, spaceNote, glyph, navigate, hintLine, readHintConfig, ROW_H } from "./tiles.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("gpui-kit").FocusHandle} FocusHandle */
/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {import("herdr").TabInfo} TabInfo */
/** @typedef {import("herdr").AgentInfo} AgentInfo */
/** @typedef {import("./tiles.js").HintConfig} HintConfig */
/** @typedef {{ kind: "space", s: SpaceInfo, hint?: string, pinned?: boolean }} SpaceItem */
/** @typedef {{ kind: "tab", s: SpaceInfo, tab: TabInfo, who: string, status: string | null, hint?: string, pinned?: boolean }} TabItem */
/** @typedef {{ kind: "agent", s: SpaceInfo, agent: AgentInfo, hint?: string, pinned?: boolean }} AgentItem */
/** @typedef {{ kind: "new-tab" | "new-space", hint: string, pinned?: boolean }} NewItem */
/** @typedef {SpaceItem | TabItem | AgentItem | NewItem} Item */

// These do things, so they can't be hints.
const RESERVED = "tnqjkxr";

export default class Jump extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    /** @type {number | null} null until the first render lands on the active tab */
    this.at = null;
    /** @type {string} */
    this.typed = "";
    /** @type {{ it: SpaceItem | TabItem | NewItem, input: ReturnType<typeof InputState.new> } | null} */
    this.renaming = null;
    /** @type {HintConfig} */
    this.hintConfig = { spaces: {}, tabs: {} };
    cx.spawn(async (cx) => { this.hintConfig = await readHintConfig(readTextFile, appHome); cx.notify(); });
    /** @type {FocusHandle} */
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(600, () => this.handle.focus());
  }

  close() {
    closeOverlay(props().overlay);
  }

  /** Each space, its tabs and agents, then the two new rows. @returns {Item[]} */
  items() {
    /** @type {Item[]} */
    const out = [];
    const ps = panes();
    const ag = agents();
    const agentTabs = new Set(ag.map((a) => a.tab));
    for (const s of spaces()) {
      const tabs = s.tabs ?? [];
      out.push({ kind: "space", s });
      for (const tab of tabs) {
        if (agentTabs.has(tab.id)) continue;
        const mine = ps.filter((p) => p.tab === tab.id);
        const who = mine.map((p) => p.mod ?? p.program?.name ?? "shell");
        out.push({ kind: "tab", s, tab, who: [...new Set(who)].join(" · "), status: tab.status ?? null });
      }
      for (const agent of ag.filter((a) => a.space === s.id)) out.push({ kind: "agent", s, agent });
    }
    const wanted = out.map((it) => (it.kind === "space" ? this.hintConfig.spaces[it.s.name] : it.kind === "tab" ? this.hintConfig.tabs[`${it.s.name}/${it.tab.name}`] : null));
    const hs = hints(out.length, RESERVED, wanted);
    out.forEach((it, i) => { it.hint = hs[i]; it.pinned = !!wanted[i] && hs[i] === String(wanted[i]).toLowerCase(); });
    out.push({ kind: "new-tab", hint: "t" });
    out.push({ kind: "new-space", hint: "n" });
    return out;
  }

  /** Goes where the item points, then closes. A new tab or space asks for its name first. @param {Item | undefined} it @param {Context} cx */
  go(it, cx) {
    if (!it) return;
    if (it.kind === "new-space" || it.kind === "new-tab") return this.startRename(it, cx);
    this.close();
    if (it.kind === "agent") run("agent.focus", { terminal: it.agent.address });
    else if (it.kind === "tab") run("tab.select", { id: it.tab.id });
    else if (it.kind === "space") run("space.select", { id: it.s.id });
  }

  /** Opens the name box for a tab or space, or empty for a new tab or space. @param {SpaceItem | TabItem | NewItem} it @param {Context} cx */
  startRename(it, cx) {
    const name = it.kind === "new-space" || it.kind === "new-tab" ? "" : it.kind === "tab" ? it.tab.name : it.kind === "space" ? it.s.name : "";
    const input = InputState.new({ value: name, placeholder: it.kind === "new-tab" || it.kind === "tab" ? "Tab name" : "Space name" });
    input.set_selected_range({ start: 0, end: name.length });
    input.on("submit", (_e, cx) => this.finishRename(true, cx));
    input.focus();
    this.renaming = { it, input };
    cx.notify();
  }

  /** Closes the name box, saving when asked. The popup stays open. @param {boolean} save @param {Context} cx */
  finishRename(save, cx) {
    if (!this.renaming) return;
    const { it, input } = this.renaming;
    this.renaming = null;
    if (it.kind === "new-space" || it.kind === "new-tab") {
      const name = input.value().trim();
      // Start in the home folder, not the current space's folder, so a new space shares nothing.
      if (save && name) { this.close(); if (it.kind === "new-tab") run("tab.new", { name }); else run("space.new", { folder: home(), name }); return; }
    } else if (save) {
      if (it.kind === "tab") run("tab.rename", { id: it.tab.id, name: input.value() });
      else if (it.kind === "space") run("space.rename", { id: it.s.id, name: input.value() });
    }
    this.handle.focus();
    cx.notify();
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    // While the name box is open, every key but Esc belongs to it.
    if (this.renaming) {
      if (e.key === "escape") { this.finishRename(false, cx); cx.stop_propagation(); }
      return;
    }
    const items = this.items();
    /** @type {import("./tiles.js").NavState} */
    const state = { at: this.at ?? 0, typed: this.typed };
    const r = navigate(state, e, items);
    this.at = state.at;
    this.typed = state.typed;
    if (r === "close") { this.close(); cx.stop_propagation(); return; }
    if (r === "hit" || r === "act") this.go(items[this.at], cx);
    if (r) { cx.stop_propagation(); cx.notify(); return; }
    const it = items[this.at];
    if (e.keystroke === "x" && it?.kind === "tab") {
      // Stay open: the row drops out when the live data changes. Closing the active tab can move focus, so take it back.
      run("tab.close", { id: it.tab.id, confirmed: true });
      cx.timer.after(150, () => this.handle.focus());
    } else if (e.keystroke === "r" && (it?.kind === "tab" || it?.kind === "space")) this.startRename(it, cx);
    else if (e.keystroke === "q") this.close();
    else return;
    cx.stop_propagation();
  }

  /** @param {Context} cx */
  render(cx) {
    const t = colors();
    const items = this.items();
    // Prefer the focused agent, then a destination in the active tab.
    if (this.at === null) {
      const focused = items.findIndex((it) => it.kind === "agent" && it.agent.focused);
      const active = items.findIndex((it) => (it.kind === "tab" && it.s.active && it.tab.active)
        || (it.kind === "agent" && it.s.active && it.s.tabs.some((tab) => tab.id === it.agent.tab && tab.active)));
      this.at = Math.max(0, focused >= 0 ? focused : active);
    }
    this.at = Math.max(0, Math.min(this.at, items.length - 1));
    const at = this.at;
    const all = spaces();
    // gpui elements are single-use, so collect each block's rows first and build it after.
    /** @type {{ rows: ReturnType<typeof row>[], tabs: ReturnType<typeof row>[], agents: ReturnType<typeof row>[] }[]} */
    const blocks = [];
    /** @type {ReturnType<typeof h_flex>[]} */
    const extras = [];
    items.forEach((it, i) => {
      const on = i === at;
      if (it.kind === "space") {
        blocks.push({ tabs: [], agents: [], rows: [
          row(t, { id: `j-space-${it.s.id}`, hint: it.hint ?? "", typed: this.typed, pinned: it.pinned, on, onClick: (_e, cx) => this.go(it, cx) })
            .child(div().flex_none().max_w(260).truncate().text_size(16).font_semibold().text_color(t.foreground).child(it.s.name))
            .child(div().flex_1().truncate().text_size(11).text_color(t.dim).child(spaceNote(all, it.s, home())))
            .child(div().text_size(10).text_color(t.dim).child("Space")),
        ] });
      } else if (it.kind === "tab") {
        const name = !it.tab.named && /^\d+$/.test(it.tab.name) ? it.who || "Tab" : it.tab.name;
        blocks[blocks.length - 1].tabs.push(
          row(t, { id: `j-tab-${it.tab.id}`, hint: it.hint ?? "", typed: this.typed, pinned: it.pinned, on, onClick: (_e, cx) => this.go(it, cx) })
            .child(div().w(18).flex_none())
            .child(div().flex_none().max_w(220).truncate().text_color(t.muted).child(name))
            .when(!!it.status, (el) => el.child(glyph(t, it.status)))
            .child(div().flex_1().truncate().text_size(11).text_color(t.dim).child(name === it.who ? "" : it.who || "empty")),
        );
      } else if (it.kind === "agent") {
        const tab = it.s.tabs.find((tab) => tab.id === it.agent.tab);
        const tabName = !tab?.named && /^\d+$/.test(it.agent.tab_name) ? "" : it.agent.tab_name;
        blocks[blocks.length - 1].agents.push(
          row(t, { id: `j-agent-${it.agent.address}`, hint: it.hint ?? "", typed: this.typed, pinned: false, on, onClick: (_e, cx) => this.go(it, cx) })
            .child(div().w(18).flex_none())
            .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(it.agent.title || it.agent.program.name || it.agent.app || "Agent"))
            .child(div().flex_none().max_w(180).truncate().text_size(11).text_color(t.dim).child([tabName, it.agent.program.name].filter(Boolean).join(" · ")))
            .child(glyph(t, it.agent.status)),
        );
      } else {
        extras.push(
          h_flex().id(`j-${it.kind}`).gap(4).items_center().text_size(11).rounded(3)
            .when(on, (el) => el.bg(t.selected))
            .cursor_pointer().hover((style) => style.bg(t.hover))
            .on_click((_e, cx) => this.go(it, cx))
            .child(div().text_color(t.accent).font_semibold().child(it.hint))
            .child(div().text_color(t.dim).child(it.kind === "new-tab" ? "new tab" : "new space")),
        );
      }
    });
    /** @param {string} name */
    const label = (name) => div().h(20).flex_none().pl(70).text_size(10).font_semibold().text_color(t.accent).child(name);
    const rowCount = blocks.reduce((n, b) => n + b.rows.length + b.tabs.length + b.agents.length, 0);
    const labelCount = blocks.reduce((n, b) => n + Number(b.tabs.length > 0) + Number(b.agents.length > 0), 0);
    const sections = blocks.map((b, i) => v_flex().gap(2)
      .when(i > 0, (el) => el.pt(8).border_t(1).border_color(t.border))
      .children(b.rows)
      .when(b.tabs.length > 0, (el) => el.child(label("Tabs")).children(b.tabs))
      .when(b.agents.length > 0, (el) => el.child(label("Agents")).children(b.agents)));
    // The popup sizes to content, so the scrollable list needs an explicit height or it collapses.
    const est = rowCount * (ROW_H + 2) + labelCount * 22 + blocks.length * 16 + 16;
    const listH = Math.min(560, est);

    return v_flex()
      .id("jump")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .w_full()
      .min_h(0)
      .p(18)
      .gap(10)
      .bg(panelFill(t, 1, 0.1, t.popover)) // the dialogs' popover color at the islands panel opacity, a bit more solid
      .rounded(14).overflow_hidden().border_1().border_color(t.border) // our own frame (mod.json says frame: none); no shadow, Herdr clips it
      .text_size(13)
      .child(
        h_flex().items_center().gap(10)
          .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Jump to…"))
          .child(div().pr(10).text_size(11).text_color(t.dim).child("Esc")),
      )
      .when(!!this.renaming, (el) => el.child(
        h_flex().items_center().gap(10)
          .child(div().flex_none().text_size(11).text_color(t.dim).child(this.renaming?.it.kind === "new-space" ? "New space" : this.renaming?.it.kind === "new-tab" ? "New tab" : this.renaming?.it.kind === "tab" ? "Rename tab" : "Rename space"))
          .child(Input.new(this.renaming?.input).flex_1().h(30).px(8).rounded(6).border_1().border_color(t.accent).bg(t.background).text_size(12.5).text_color(t.foreground)),
      ))
      .child(v_flex().id("jump-list").h(listH).flex_none().overflow_y_scrollbar().gap(8).children(sections))
      .child(h_flex().flex_none().flex_wrap().items_center().gap(12)
        .child(hintLine(t, [["j/k", "move"], ["x", "close tab"], ["r", "rename"]]))
        .children(extras));
  }
}
