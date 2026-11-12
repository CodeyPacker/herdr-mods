import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, ScrollHandle } from "gpui-base";
import { spaces, panes, agents, run, props, closeOverlay, readTextFile, writeTextFile, appHome, home } from "herdr";
import { colors, SIZE } from "./kit/theme.js";
import { frame, divider } from "./kit/frame.js";
import { textInput } from "./kit/controls.js";
import { hint } from "./kit/legend.js";
import { assignLetters, letterRow, navigateByLetter, readLetterConfig, LETTERS_FILE } from "./kit/letters.js";
import { statusDot, spaceNote } from "./kit/spaces.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("gpui-kit").FocusHandle} FocusHandle */
/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {import("herdr").TabInfo} TabInfo */
/** @typedef {import("herdr").AgentInfo} AgentInfo */
/** @typedef {import("./kit/letters.js").LetterConfig} HintConfig */
/** @typedef {{ kind: "space", s: SpaceInfo, hint?: string, pinned?: boolean }} SpaceItem */
/** @typedef {{ kind: "tab", s: SpaceInfo, tab: TabInfo, who: string, status: string | null, hint?: string, pinned?: boolean }} TabItem */
/** @typedef {{ kind: "agent", s: SpaceInfo, agent: AgentInfo, hint?: string, pinned?: boolean }} AgentItem */
/** @typedef {{ kind: "new-tab" | "new-space", hint: string, pinned?: boolean }} NewItem */
/** @typedef {SpaceItem | TabItem | AgentItem | NewItem} Item */

// These do things, so they can't be hints.
const RESERVED = "tnqjkxr";
/** A "Tabs" or "Agents" label's height, and the margin above and below the line between spaces. */
const LABEL_H = 22;
const SPACE_GAP = 6;
/** How far a space's tabs and agents are set in: up to the line under the space's badge, then from the line to the row. */
const CHILD_INDENT = 22;
const CHILD_PAD = 10;
/**
 * The list scrolls past this height. The popup may be at most 75% of the window (mod.json), and
 * the frame's title, legend and padding take about 125 px of that, so this keeps the legend on
 * screen in a window as short as 800 px.
 */
const MAX_LIST_H = 470;

/** A chosen letter in lower case, or null when it is not letters or uses a reserved one. @param {unknown} v */
function validLetters(v) {
  const p = String(v ?? "").toLowerCase();
  return /^[a-z]+$/.test(p) && ![...p].some((c) => RESERVED.includes(c)) ? p : null;
}

/** The name of the tab a row stands for. @param {TabItem | AgentItem} it */
function tabNameOf(it) {
  return it.kind === "tab" ? it.tab.name : it.agent.tab_name;
}

/** @param {Record<string, string>} o */
function lowerKeys(o) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
}

export default class Jump extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    /** @type {number | null} null until the first render lands on the active tab */
    this.at = null;
    /** @type {string} */
    this.typed = "";
    /** The open name box. `key`: it sets the row's letter, not its name. @type {{ it: SpaceItem | TabItem | AgentItem | NewItem, input: ReturnType<typeof InputState.new>, key?: boolean } | null} */
    this.renaming = null;
    /** @type {HintConfig} */
    this.hintConfig = { spaces: {}, tabs: {} };
    /** The space whose letter was just typed: the next letter picks among its tabs. @type {string | null} */
    this.scope = null;
    cx.spawn(async (cx) => {
      // Names match in any case, so keep the keys in lower case.
      const c = await readLetterConfig(readTextFile, appHome);
      this.hintConfig = { spaces: lowerKeys(c.spaces), tabs: lowerKeys(c.tabs) };
      cx.notify();
    });
    /** @type {FocusHandle} */
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(600, () => this.handle.focus());
    /** The list's scroll position, so the selected row stays in view. */
    this.scroll = ScrollHandle.new();
    /** True after the selection moves, until the next render scrolls to it. */
    this.reveal = true;
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
    const cfg = this.hintConfig;
    // Chosen letters may repeat: every space's "Code" tab can be "c". An agent uses its tab's letter.
    const chosen = out.map((it) => {
      if (it.kind === "space") return validLetters(cfg.spaces[it.s.name.toLowerCase()]);
      if (it.kind !== "tab" && it.kind !== "agent") return null;
      const name = String(tabNameOf(it)).toLowerCase();
      return validLetters(cfg.tabs[`${it.s.name.toLowerCase()}/${name}`] ?? cfg.tabs[name]);
    });
    // The other rows get one letter each that no chosen letter starts with.
    const used = [...new Set(chosen.map((h) => h?.[0] ?? ""))].join("");
    const rest = assignLetters(chosen.filter((h) => !h).length, RESERVED + used);
    let next = 0;
    out.forEach((it, i) => { it.hint = chosen[i] ?? rest[next++]; it.pinned = !!chosen[i]; });
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
    const { it, input, key } = this.renaming;
    this.renaming = null;
    if (key) {
      if (save && (it.kind === "space" || it.kind === "tab" || it.kind === "agent")) this.saveLetter(it, input.value(), cx);
    } else if (it.kind === "new-space" || it.kind === "new-tab") {
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

  /** Opens the box that sets a row's letter. @param {SpaceItem | TabItem | AgentItem} it @param {Context} cx */
  startRekey(it, cx) {
    const now = it.pinned ? it.hint ?? "" : "";
    const input = InputState.new({ value: now, placeholder: "A letter, or empty for an automatic one" });
    input.set_selected_range({ start: 0, end: now.length });
    input.on("submit", (_e, cx) => this.finishRename(true, cx));
    input.focus();
    this.renaming = { it, input, key: true };
    cx.notify();
  }

  /**
   * Saves a row's letter to hints.json: a space by its name, a tab as "space/tab", so it applies to
   * that one tab. An empty value removes the entry. Letters that cannot be used are not saved.
   * @param {SpaceItem | TabItem | AgentItem} it @param {string} value @param {Context} cx
   */
  saveLetter(it, value, cx) {
    const letters = value.trim().toLowerCase();
    if (letters && !validLetters(letters)) return;
    const group = it.kind === "space" ? "spaces" : "tabs";
    const name = it.kind === "space" ? it.s.name : `${it.s.name}/${tabNameOf(it)}`;
    cx.spawn(async (cx) => {
      const path = appHome() + "/" + LETTERS_FILE;
      try {
        const text = await readTextFile(path);
        const json = text ? JSON.parse(text) : {};
        /** @type {Record<string, string>} */
        const entries = json[group] ?? {};
        for (const k of Object.keys(entries)) if (k.toLowerCase() === name.toLowerCase()) delete entries[k];
        if (letters) entries[name] = letters;
        json[group] = entries;
        await writeTextFile(path, JSON.stringify(json, null, 2) + "\n", text);
        this.hintConfig = { spaces: lowerKeys(json.spaces ?? {}), tabs: lowerKeys(json.tabs ?? {}) };
      } catch {
        // The file could not be read or written, so the letters stay as they were.
      }
      cx.notify();
    });
  }

  /**
   * A typed letter. One row has it: go there. Several rows have it: move to the next one, and
   * enter opens it. A space whose tabs share letters with other rows is selected and waits, so
   * the next letter picks among its tabs.
   * @param {string} k @param {Item[]} items @param {Context} cx
   * @returns {boolean} whether the letter was used
   */
  letter(k, items, cx) {
    const typed = this.typed + k;
    const scope = this.scope;
    const pool = items.map((_it, i) => i).filter((i) => {
      const it = items[i];
      return !scope || ((it.kind === "tab" || it.kind === "agent") && it.s.id === scope);
    });
    const hits = pool.filter((i) => items[i].hint === typed);
    const more = pool.some((i) => items[i].hint !== typed && items[i].hint?.startsWith(typed));
    // Not one of this space's letters: try it on the whole list.
    if (scope && hits.length === 0 && !more) { this.scope = null; return this.letter(k, items, cx); }
    if (hits.length === 0) { this.typed = more ? typed : ""; return more; }
    this.typed = "";
    const it = items[hits[0]];
    if (hits.length === 1 && (it.kind === "new-tab" || it.kind === "new-space")) { this.go(it, cx); return true; }
    const from = this.at ?? 0;
    this.at = hits.length === 1 ? hits[0] : hits.find((i) => i > from) ?? hits[0];
    this.reveal = true;
    if (hits.length > 1) return true;
    if (it.kind === "space" && this.sharesLetters(it.s.id, items)) { this.scope = it.s.id; return true; }
    this.go(it, cx);
    return true;
  }

  /** Whether a tab or agent in this space has the same letters as another row. @param {string} spaceId @param {Item[]} items */
  sharesLetters(spaceId, items) {
    /** @type {Map<string, number>} */
    const count = new Map();
    for (const it of items) count.set(it.hint ?? "", (count.get(it.hint ?? "") ?? 0) + 1);
    return items.some((it) => (it.kind === "tab" || it.kind === "agent") && it.s.id === spaceId && (count.get(it.hint ?? "") ?? 0) > 1);
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    // While the name box is open, every key but Esc belongs to it.
    if (this.renaming) {
      if (e.key === "escape") { this.finishRename(false, cx); cx.stop_propagation(); }
      return;
    }
    const items = this.items();
    const noMods = !e.modifiers.control && !e.modifiers.alt && !e.modifiers.platform && !e.modifiers.shift;
    // Esc first leaves the space that is waiting for a tab letter.
    if (e.key === "escape" && this.scope) { this.scope = null; cx.stop_propagation(); cx.notify(); return; }
    // Letters are handled here, since several rows can share one. j and k move, below.
    if (noMods && /^[a-z]$/.test(e.key) && e.key !== "j" && e.key !== "k") {
      if (this.letter(e.key, items, cx)) { cx.stop_propagation(); cx.notify(); return; }
      return this.actionKey(e, items, cx);
    }
    this.scope = null;
    /** @type {import("./kit/letters.js").NavState} */
    const state = { at: this.at ?? 0, typed: this.typed };
    // The new tab and new space rows sit in the footer, outside the list, so moving covers the list rows only.
    const last = items.findLastIndex((it) => it.kind !== "new-tab" && it.kind !== "new-space");
    const from = state.at;
    const r = navigateByLetter(state, e, items);
    if (r === "done") state.at = Math.min(state.at, last);
    // Moving past either end wraps around to the other.
    const plain = !e.modifiers.control && !e.modifiers.alt && !e.modifiers.platform;
    const down = e.keystroke === "ctrl-n" || (plain && (e.key === "down" || e.key === "j"));
    const up = e.keystroke === "ctrl-p" || (plain && (e.key === "up" || e.key === "k"));
    if (r === "done" && down && from >= last) state.at = 0;
    else if (r === "done" && up && from === 0) state.at = last;
    if (state.at !== from) this.reveal = true;
    this.at = state.at;
    this.typed = state.typed;
    if (r === "close") { this.close(); cx.stop_propagation(); return; }
    if (r === "hit" || r === "act") this.go(items[this.at], cx);
    if (r) { cx.stop_propagation(); cx.notify(); return; }
    this.actionKey(e, items, cx);
  }

  /** The keys that act on the selected row. @param {KeyEvent} e @param {Item[]} items @param {Context} cx */
  actionKey(e, items, cx) {
    const it = items[this.at ?? 0];
    if (e.keystroke === "shift-r" && (it?.kind === "tab" || it?.kind === "space" || it?.kind === "agent")) this.startRekey(it, cx);
    else if (e.keystroke === "x" && it?.kind === "tab") {
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
    /** A row's shell: its letter badge first. @param {string} id @param {Item} it @param {boolean} on */
    const shell = (id, it, on) => letterRow(t, {
      id, letters: it.hint ?? "", typed: this.typed, pinned: it.pinned, on, compact: true, click: (cx) => this.go(it, cx),
    });
    /** The small print at a row's right. @param {string} text */
    const detail = (text) => div().flex_none().max_w(200).truncate().text_size(SIZE.small).text_color(t.dim).child(text);
    // gpui elements are single-use, so collect each block's rows first and build it after.
    // Each row keeps its item index, so the selected one can be scrolled into view.
    /** @typedef {{ el: ReturnType<typeof shell>, i: number }} Row */
    /** @type {{ rows: Row[], tabs: Row[], agents: Row[] }[]} */
    const blocks = [];
    /** The new tab and new space rows: they sit in the legend, as hints that are also buttons. @type {ReturnType<typeof hint>[]} */
    const extras = [];
    items.forEach((it, i) => {
      const on = i === at;
      if (it.kind === "space") {
        blocks.push({ tabs: [], agents: [], rows: [{ i, el:
          shell(`j-space-${it.s.id}`, it, on)
            .child(div().flex_none().max_w(260).truncate().text_size(14).font_semibold().text_color(t.foreground).child(it.s.name))
            .child(div().flex_1().min_w(0).truncate().text_size(SIZE.small).text_color(t.dim).child(spaceNote(all, it.s, home())))
            .child(detail("Space")),
        }] });
      } else if (it.kind === "tab") {
        const name = !it.tab.named && /^\d+$/.test(it.tab.name) ? it.who || "Tab" : it.tab.name;
        blocks[blocks.length - 1].tabs.push({ i, el:
          shell(`j-tab-${it.tab.id}`, it, on)
            .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(name))
            .when(!!it.status, (el) => el.child(statusDot(t, it.status)))
            .child(detail(name === it.who ? "" : it.who || "empty")),
        });
      } else if (it.kind === "agent") {
        const tab = it.s.tabs.find((tab) => tab.id === it.agent.tab);
        const tabName = !tab?.named && /^\d+$/.test(it.agent.tab_name) ? "" : it.agent.tab_name;
        blocks[blocks.length - 1].agents.push({ i, el:
          shell(`j-agent-${it.agent.address}`, it, on)
            .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(it.agent.title || it.agent.program.name || it.agent.app || "Agent"))
            .child(detail([tabName, it.agent.program.name].filter(Boolean).join(" · ")))
            .child(statusDot(t, it.agent.status)),
        });
      } else {
        extras.push(hint(t, [it.hint, it.kind === "new-tab" ? "new tab" : "new space"], { id: `j-${it.kind}`, click: (cx) => this.go(it, cx) }));
      }
    });
    // A section label lines up with the text after the letter badge: the row's padding, the badge, the gap.
    /** @param {string} name */
    const label = (name) => div().h(LABEL_H).flex_none().pl(44).pt(4).text_size(SIZE.small).font_semibold().text_color(t.dim).child(name);
    const rowCount = blocks.reduce((n, b) => n + b.rows.length + b.tabs.length + b.agents.length, 0);
    const labelCount = blocks.reduce((n, b) => n + Number(b.tabs.length > 0) + Number(b.agents.length > 0), 0);
    // One flat column, so the scroll handle can reveal a row by its place among the list's children.
    // A line between spaces sets them apart.
    /** @type {any[]} */
    const kids = [];
    let selectedKid = -1;
    /** @param {Row} r */
    const add = (r) => { if (r.i === at) selectedKid = kids.length; kids.push(r.el); };
    // What sits inside a space is set in from it, behind a line that drops from the space's letter badge.
    /** @param {any} el */
    const inside = (el) => v_flex().flex_none().ml(CHILD_INDENT).pl(CHILD_PAD).border_l_1().border_color(t.border).child(el);
    /** @param {Row} r */
    const addInside = (r) => add({ i: r.i, el: inside(r.el) });
    blocks.forEach((b, i) => {
      if (i > 0) kids.push(divider(t).my(SPACE_GAP));
      b.rows.forEach(add);
      if (b.tabs.length > 0) { kids.push(inside(label("Tabs"))); b.tabs.forEach(addInside); }
      if (b.agents.length > 0) { kids.push(inside(label("Agents"))); b.agents.forEach(addInside); }
    });
    if (this.reveal && selectedKid >= 0) { this.scroll.scroll_to_item(selectedKid); this.reveal = false; }
    // The popup sizes to content, so the scrollable list needs an explicit height or it collapses.
    // Every child is followed by the list's 2 px gap, and a line between spaces has its margin above and below.
    const est = rowCount * (SIZE.compactRow + 2) + labelCount * (LABEL_H + 2) + Math.max(0, blocks.length - 1) * (SPACE_GAP * 2 + 3);
    const listH = Math.min(MAX_LIST_H, est);

    return frame(t, { id: "jump", title: "Jump to…", handle: this.handle, onKey: (e, cx) => this.key(e, cx) })
      .when(!!this.renaming, (el) => el.child(
        h_flex().items_center().gap(10)
          .child(div().flex_none().text_size(SIZE.small).text_color(t.dim).child(this.renaming?.key ? (this.renaming.it.kind === "space" ? "Key for space" : "Key for tab") : this.renaming?.it.kind === "new-space" ? "New space" : this.renaming?.it.kind === "new-tab" ? "New tab" : this.renaming?.it.kind === "tab" ? "Rename tab" : "Rename space"))
          .child(textInput(t, this.renaming?.input).flex_1()),
      ))
      .child(v_flex().id("jump-list").h(listH).flex_none().overflow_y_scrollbar().track_scroll(this.scroll).gap(2).children(kids))
      .child(divider(t))
      .child(h_flex().flex_none().flex_wrap().items_center().gap(12).text_size(SIZE.small)
        .child(hint(t, ["j/k", "move"])).child(hint(t, ["x", "close tab"])).child(hint(t, ["r", "rename"])).child(hint(t, ["R", "set key"]))
        .children(extras));
  }
}
