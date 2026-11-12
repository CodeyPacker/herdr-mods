import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, ScrollHandle } from "gpui-base";
import { spaces, panes, agents, run, props, closeOverlay, readTextFile, writeTextFile, appHome, home } from "herdr";
import { colors, SIZE } from "./kit/theme.js";
import { frame, divider } from "./kit/frame.js";
import { textInput } from "./kit/controls.js";
import { hint } from "./kit/legend.js";
import { assignLetters, letterRow, navigateByLetter, readLetterConfig, configColor, LETTERS_FILE } from "./kit/letters.js";
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

// These do things, so they can't be hints. Capitals are letters of their own, typed with shift: R sets a row's letter.
const RESERVED = "tnqjkxrR";
/** A "Tabs" or "Agents" label's height, and the margin above and below the line between spaces. */
const LABEL_H = 22;
const SPACE_GAP = 6;
/** How far a space's tabs and agents are set in: up to the line under the space's badge, then from the line to the row. */
const CHILD_INDENT = 22;
const CHILD_PAD = 10;
/**
 * The list scrolls past its largest height. The popup may be at most this share of the window
 * (the same number as mod.json's height), and the frame's title, legend and padding take about
 * 130 px of that, so the list gets the rest and the legend stays on screen.
 */
const POPUP_SHARE = 0.9;
const FRAME_H = 130;
/** The list's largest height when the window's size cannot be read. */
const FALLBACK_LIST_H = 470;
/** The popup's width with the list look. mod.json gives the overlay most of the window, and the frame is centered in it at its own width. */
const LIST_W = 560;
/** The card look: a card's width and inner padding, and the space between cards. */
const CARD_W = 400;
const CARD_PAD = 6;
const CARD_GAP = 12;
/** How strong the text color is in a card's background, as the last two digits of a hex color: 18 is 9%. */
const CARD_WASH = "18";
/** The card look starts with this many columns, and adds more when the cards would not fit the window's height. */
const START_COLS = 2;

/** A chosen letter, or null when it is not letters or uses a reserved one. "C" and "c" are different letters. @param {unknown} v */
function validLetters(v) {
  const p = String(v ?? "").trim();
  return /^[a-zA-Z]+$/.test(p) && ![...p].some((c) => RESERVED.includes(c)) ? p : null;
}

/** The name of the tab a row stands for. @param {TabItem | AgentItem} it */
function tabNameOf(it) {
  return it.kind === "tab" ? it.tab.name : it.agent.tab_name;
}

/** Orders two names by their letters in any case. The app's localeCompare puts capitals first. @param {string} a @param {string} b */
function byName(a, b) {
  const x = a.toLowerCase(), y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/** @param {Record<string, string>} o */
function lowerKeys(o) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
}

/**
 * Lays cards, kept in order, into a grid of at most `cols` columns, filled one column at a time.
 * Every card in a row is as tall as the row's tallest card.
 * @param {number[]} heights each card's own height @param {number} cols @param {number} gap the space between two cards
 * @returns {{ columns: number[][], rowHeights: number[], height: number }} each column's card indexes, each row's height, and the grid's height
 */
function splitIntoColumns(heights, cols, gap) {
  const rows = Math.ceil(heights.length / Math.max(1, cols));
  /** @type {number[][]} */
  const columns = [];
  /** @type {number[]} */
  const rowHeights = new Array(rows).fill(0);
  heights.forEach((h, i) => {
    const row = i % rows;
    if (row === 0) columns.push([]);
    columns[columns.length - 1].push(i);
    rowHeights[row] = Math.max(rowHeights[row], h);
  });
  return { columns, rowHeights, height: rowHeights.reduce((n, h) => n + h, 0) + Math.max(0, rows - 1) * gap };
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
    /** Why a letter was not saved, shown under the title until the next key. */
    this.note = "";
    /** Where the last render drew each row in the card look, by item index: its column and how far down. Null in the list look. @type {Map<number, { col: number, y: number }> | null} */
    this.cells = null;
    cx.spawn(async (cx) => {
      // Names match in any case, so keep the keys in lower case.
      const c = await readLetterConfig(readTextFile, appHome);
      this.hintConfig = { ...c, spaces: lowerKeys(c.spaces), tabs: lowerKeys(c.tabs) };
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

  /** Whether the config asks for the card look: a card per space, in columns. */
  cards() {
    return this.hintConfig.jumpLayout === "cards";
  }

  /** Each space, its tabs and agents, then the two new rows. @returns {Item[]} */
  items() {
    /** @type {Item[]} */
    const out = [];
    const ps = panes();
    const ag = agents();
    const agentTabs = new Set(ag.map((a) => a.tab));
    // Cards go by name, so a space keeps its place as others come and go.
    const ordered = this.cards() ? [...spaces()].sort((a, b) => byName(a.name, b.name)) : spaces();
    for (const s of ordered) {
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

  /** Opens the name box for a tab or space, or empty for a new tab or space. An agent's row renames the tab it runs in. @param {SpaceItem | TabItem | AgentItem | NewItem} it @param {Context} cx */
  startRename(it, cx) {
    const name = it.kind === "tab" ? it.tab.name : it.kind === "agent" ? it.agent.tab_name ?? "" : it.kind === "space" ? it.s.name : "";
    const input = InputState.new({ value: name, placeholder: it.kind === "new-space" || it.kind === "space" ? "Space name" : "Tab name" });
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
    this.note = "";
    if (key && save) {
      // A letter that cannot be used keeps the box open and says why, so it never fails without a word.
      const bad = [...input.value().trim()].find((c) => !/[a-zA-Z]/.test(c) || RESERVED.includes(c));
      if (bad) {
        this.note = /[a-zA-Z]/.test(bad) ? `"${bad}" is one of jump's own keys: ${[...RESERVED].join(" ")}` : "Letters only";
        cx.notify();
        return;
      }
    }
    this.renaming = null;
    if (key) {
      if (save && (it.kind === "space" || it.kind === "tab" || it.kind === "agent")) this.saveLetter(it, input.value(), cx);
    } else if (it.kind === "new-space" || it.kind === "new-tab") {
      const name = input.value().trim();
      // Start in the home folder, not the current space's folder, so a new space shares nothing.
      if (save && name) { this.close(); if (it.kind === "new-tab") run("tab.new", { name }); else run("space.new", { folder: home(), name }); return; }
    } else if (save) {
      if (it.kind === "tab") run("tab.rename", { id: it.tab.id, name: input.value() });
      else if (it.kind === "agent") run("tab.rename", { id: it.agent.tab, name: input.value() });
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
    const letters = value.trim();
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
        this.hintConfig = { ...this.hintConfig, spaces: lowerKeys(json.spaces ?? {}), tabs: lowerKeys(json.tabs ?? {}) };
      } catch (err) {
        // The file could not be read or written, so the letters stay as they were.
        this.note = `Could not save to ${LETTERS_FILE}: ${err instanceof Error ? err.message : String(err)}`;
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

  /**
   * Moves the selection to the next column in the card look, to the row nearest the same height.
   * @param {number} side -1 for left, 1 for right
   * @returns {boolean} whether the selection moved
   */
  moveColumn(side) {
    const here = this.cells?.get(this.at ?? 0);
    if (!this.cells || !here) return false;
    let best = -1, bestGap = Infinity;
    for (const [i, cell] of this.cells) {
      const gap = Math.abs(cell.y - here.y);
      if (cell.col === here.col + side && gap < bestGap) { best = i; bestGap = gap; }
    }
    if (best < 0) return false;
    this.at = best;
    this.typed = "";
    this.scope = null;
    return true;
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    // While the name box is open, every key but Esc belongs to it.
    if (this.renaming) {
      if (e.key === "escape") { this.finishRename(false, cx); cx.stop_propagation(); }
      return;
    }
    this.note = "";
    // Ctrl with h and l moves between columns, so the letters stay free for rows, capitals too. The arrows do the same.
    const side = e.keystroke === "ctrl-h" || e.keystroke === "left" ? -1 : e.keystroke === "ctrl-l" || e.keystroke === "right" ? 1 : 0;
    if (side) { if (this.moveColumn(side)) cx.notify(); cx.stop_propagation(); return; }
    // Ctrl with j and k moves like the plain keys, so ctrl can stay held for all four.
    if (e.keystroke === "ctrl-j" || e.keystroke === "ctrl-k") {
      const k = e.keystroke === "ctrl-j" ? "j" : "k";
      e = { ...e, key: k, keystroke: k, modifiers: { ...e.modifiers, control: false } };
    }
    const items = this.items();
    const noMods = !e.modifiers.control && !e.modifiers.alt && !e.modifiers.platform;
    // Esc first leaves the space that is waiting for a tab letter.
    if (e.key === "escape" && this.scope) { this.scope = null; cx.stop_propagation(); cx.notify(); return; }
    // Letters are handled here, since several rows can share one. With shift a letter is its capital,
    // which is a letter of its own. Plain j and k move, below.
    const letter = noMods && /^[a-z]$/i.test(e.key) ? (e.modifiers.shift ? e.key.toUpperCase() : e.key.toLowerCase()) : "";
    if (letter && letter !== "j" && letter !== "k") {
      if (this.letter(letter, items, cx)) { cx.stop_propagation(); cx.notify(); return; }
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
    } else if (e.keystroke === "r" && (it?.kind === "tab" || it?.kind === "space" || it?.kind === "agent")) this.startRename(it, cx);
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
    // A space's badge has no border, so only what is inside a space is outlined. Its letter takes the config's color.
    const spaceBadge = { border: false, color: configColor(t, this.hintConfig.spaceColor) };
    /** A row's shell: its letter badge first. @param {string} id @param {Item} it @param {boolean} on */
    const shell = (id, it, on) => letterRow(t, {
      // In the card look every tab and agent badge is drawn the same, chosen letter or not.
      id, letters: it.hint ?? "", typed: this.typed, pinned: it.pinned || (this.cards() && it.kind !== "space"), on, compact: true, click: (cx) => this.go(it, cx),
      badge: it.kind === "space" ? spaceBadge : undefined,
    });
    const cards = this.cards();
    /** The small print at a row's right. @param {string} text */
    const detail = (text) => div().flex_none().max_w(cards ? 120 : 200).truncate().text_size(SIZE.small).text_color(t.dim).child(text);
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
            .when(!cards, (el) => el.child(detail("Space"))),
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
        const title = it.agent.title || it.agent.program.name || it.agent.app || "Agent";
        blocks[blocks.length - 1].agents.push({ i, el:
          shell(`j-agent-${it.agent.address}`, it, on)
            // A named tab leads with its name, and the agent's title moves to the small print.
            .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(tabName || title))
            .child(detail((tabName ? [it.agent.title, it.agent.program.name] : [it.agent.title ? it.agent.program.name : ""]).filter(Boolean).join(" · ")))
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
    // Elements are single-use, so the list's children are built only for the list look.
    if (!cards) blocks.forEach((b, i) => {
      if (i > 0) kids.push(divider(t).my(SPACE_GAP));
      b.rows.forEach(add);
      if (b.tabs.length > 0) { kids.push(inside(label("Tabs"))); b.tabs.forEach(addInside); }
      if (b.agents.length > 0) { kids.push(inside(label("Agents"))); b.agents.forEach(addInside); }
    });
    // The list grows with the window, so it only scrolls when the window has no more room.
    let maxListH = FALLBACK_LIST_H;
    let maxW = LIST_W;
    try {
      const size = window.viewport_size();
      maxListH = Math.max(200, Math.floor(size.height * POPUP_SHARE) - FRAME_H);
      maxW = Math.floor(size.width * POPUP_SHARE);
    } catch { /* keep the fallbacks */ }
    let width = LIST_W;
    let listH = 0;
    /** @type {any} */
    let list;
    if (cards) {
      // A card: the space's row, then its tabs and agents. Its border groups them, so nothing is set in or labelled.
      const heights = blocks.map((b) => (b.rows.length + b.tabs.length + b.agents.length) * (SIZE.compactRow + 2) - 2 + CARD_PAD * 2 + 2);
      const chrome = SIZE.framePad * 2 + 2;
      const mostCols = Math.max(1, Math.floor((maxW - chrome + CARD_GAP) / (CARD_W + CARD_GAP)));
      // Two columns to start, then more while the cards are taller than the window allows.
      let cols = Math.min(START_COLS, mostCols, blocks.length);
      let split = splitIntoColumns(heights, cols, CARD_GAP);
      while (split.height > maxListH && cols < Math.min(mostCols, blocks.length)) split = splitIntoColumns(heights, ++cols, CARD_GAP);
      const used = Math.max(1, split.columns.length);
      width = used * CARD_W + (used - 1) * CARD_GAP + chrome;
      listH = Math.min(maxListH, split.height);
      // Remember where each row is drawn, for moving between columns.
      /** @type {Map<number, { col: number, y: number }>} */
      const cells = new Map();
      split.columns.forEach((col, c) => {
        let top = 0;
        col.forEach((b, row) => {
          [...blocks[b].rows, ...blocks[b].tabs, ...blocks[b].agents].forEach((r, n) => cells.set(r.i, { col: c, y: top + CARD_PAD + 1 + n * (SIZE.compactRow + 2) }));
          top += split.rowHeights[row] + CARD_GAP;
        });
      });
      this.cells = cells;
      // A thin wash of the text color sets a card off from the frame: lighter on a dark theme, darker on a light one.
      const wash = /^#[0-9a-f]{6}$/i.test(String(t.foreground)) ? /** @type {import("./kit/theme.js").Color} */ (`${t.foreground}${CARD_WASH}`) : null;
      /** @param {number} i a block's index @param {number} row its row in the grid, which sets its height */
      const card = (i, row) => v_flex().flex_none().w_full().h(split.rowHeights[row]).p(CARD_PAD).when(!!wash, (el) => el.bg(wash ?? t.popover)).gap(2).rounded(12).border_1().border_color(t.border)
        .children([...blocks[i].rows, ...blocks[i].tabs, ...blocks[i].agents].map((r) => r.el));
      list = v_flex().id("jump-list").h(listH).flex_none().overflow_y_scrollbar().track_scroll(this.scroll)
        .child(h_flex().flex_none().items_start().gap(CARD_GAP)
          .children(split.columns.map((col) => v_flex().flex_none().w(CARD_W).gap(CARD_GAP).children(col.map(card)))));
      this.reveal = false;
    } else {
      this.cells = null;
      if (this.reveal && selectedKid >= 0) { this.scroll.scroll_to_item(selectedKid); this.reveal = false; }
      // The popup sizes to content, so the scrollable list needs an explicit height or it collapses.
      // Every child is followed by the list's 2 px gap, and a line between spaces has its margin above and below.
      const est = rowCount * (SIZE.compactRow + 2) + labelCount * (LABEL_H + 2) + Math.max(0, blocks.length - 1) * (SPACE_GAP * 2 + 3);
      listH = Math.min(maxListH, est);
      list = v_flex().id("jump-list").h(listH).flex_none().overflow_y_scrollbar().track_scroll(this.scroll).gap(2).children(kids);
    }

    // The overlay is wider than the frame, so the frame sits centered in it at the width its look needs.
    return h_flex().w_full().justify_center().items_start().child(div().flex_none().w(width).child(frame(t, { id: "jump", title: "Jump to…", handle: this.handle, onKey: (e, cx) => this.key(e, cx) })
      .when(!!this.renaming, (el) => el.child(
        h_flex().items_center().gap(10)
          .child(div().flex_none().text_size(SIZE.small).text_color(t.dim).child(this.renaming?.key ? (this.renaming.it.kind === "space" ? "Key for space" : "Key for tab") : this.renaming?.it.kind === "new-space" ? "New space" : this.renaming?.it.kind === "new-tab" ? "New tab" : this.renaming?.it.kind === "space" ? "Rename space" : "Rename tab"))
          .child(textInput(t, this.renaming?.input).flex_1()),
      ))
      .when(!!this.note, (el) => el.child(div().flex_none().text_size(SIZE.small).text_color(t.blocked ?? t.accent).child(this.note)))
      .child(list)
      .child(divider(t))
      .child(h_flex().flex_none().flex_wrap().items_center().gap(12).text_size(SIZE.small)
        .child(hint(t, ["j/k", "move"])).when(cards, (el) => el.child(hint(t, ["ctrl-h/l", "column"]))).child(hint(t, ["x", "close tab"])).child(hint(t, ["r", "rename"])).child(hint(t, ["R", "set key"]))
        .children(extras))));
  }
}
