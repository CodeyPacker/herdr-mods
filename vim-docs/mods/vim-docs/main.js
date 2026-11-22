// vim-docs: a small window of Vim commands to keep open while you work. Drag it by any empty
// spot; it opens where you left it. The search box always has the keyboard. Rows show what a
// command does on the left and its keys as keycaps on the right. The selected row also shows
// its note, when it has one.
//
// Keys: up/down or ctrl-j/ctrl-k move, enter stars or unstars the selected row, tab switches
// between All and Starred, esc clears the search, then closes. Each is also a command:
// `herdr-app do vim-docs.<up|down|star|tab|cancel>`.
//
// Stars are kept in shared state under "vim-docs.favorites", so they survive restarts. The tab,
// search and selected row are kept under "vim-docs.view" when the window closes, and come back
// when it opens again.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, ScrollHandle } from "gpui-base";
import { props, closeOverlay, nextCommand, shared, setShared, settings } from "herdr";
import { colors, SIZE, focusBorder } from "./kit/theme.js";
import { DOCS, search, keyParts } from "./data.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").AsyncContext} AsyncContext */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {(typeof DOCS)[number]} Doc */

/** Where the stars are kept. */
const FAVORITES = "vim-docs.favorites";
/** The search box gets the keyboard again this long after opening, once the app has placed it. */
const REFOCUS_MS = 600;
/** Where the last view is kept: `{ tab, query, at }`. */
const VIEW = "vim-docs.view";
/** The width of the star column. */
const STAR_W = 14;

/** Stops a press so it doesn't drag the window. Herdr drags a window by any press its mod doesn't stop. */
const keep = (/** @type {any} */ el) => el.on_mouse_down("left", (/** @type {any} */ _e, /** @type {Context} */ cx) => cx.stop_propagation());

export default class VimDocs extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    // The view the window had when it last closed.
    const last = /** @type {{ tab?: string, query?: string, at?: number } | null} */ (shared(VIEW));
    /** @type {"all" | "starred"} */
    this.tab = last?.tab === "starred" ? "starred" : "all";
    /** The selected row. */
    this.at = Number(last?.at) || 0;
    /** True after the selection moves, until the next render scrolls to it. */
    this.reveal = true;
    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();
    const query = String(last?.query ?? "");
    this.query = InputState.new({ value: query, placeholder: "Search: delete word, ciw, macro" });
    // Selected, so typing starts a new search and esc clears it.
    if (query) this.query.set_selected_range({ start: 0, end: query.length });
    this.query.on("change", (_e, cx) => { this.at = 0; this.reveal = true; cx.notify(); });
    this.query.on("submit", (_e, cx) => { this.command("star"); cx.notify(); });
    this.query.focus();
    cx.timer.after(REFOCUS_MS, () => this.query.focus());
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") this.query.focus();
        else if (c) this.command(c);
        cx.notify();
      }
    });
  }

  /** The starred ids. @returns {Set<string>} */
  stars() {
    const v = shared(FAVORITES);
    return new Set(Array.isArray(v) ? v.map(String) : []);
  }

  /** Stars or unstars one entry. @param {Doc} d */
  toggleStar(d) {
    const s = this.stars();
    if (s.has(d.id)) s.delete(d.id); else s.add(d.id);
    // Kept in list order, so the file reads the same as the panel.
    setShared(FAVORITES, DOCS.filter((x) => s.has(x.id)).map((x) => x.id));
  }

  /** The rows the tab and the search keep, in the order they show. @returns {Doc[]} */
  rows() {
    const stars = this.stars();
    const pool = this.tab === "starred" ? DOCS.filter((d) => stars.has(d.id)) : DOCS;
    return search(pool, this.query.value());
  }

  /** Moves the selection, wrapping at either end. @param {number} by */
  move(by) {
    const n = this.rows().length;
    if (!n) return;
    this.at = (this.at + by + n) % n;
    this.reveal = true;
  }

  /** Closes the window. Herdr then calls the View's close below. */
  dismiss() {
    const overlay = props()?.overlay;
    if (overlay !== undefined) closeOverlay(overlay);
  }

  /** Herdr calls this as the window goes, however it was closed: keeps the view for next time. */
  async close() {
    setShared(VIEW, { tab: this.tab, query: this.query.value(), at: this.at });
  }

  /** @param {string} c */
  command(c) {
    if (c === "up") this.move(-1);
    else if (c === "down") this.move(1);
    else if (c === "tab") { this.tab = this.tab === "all" ? "starred" : "all"; this.at = 0; this.reveal = true; }
    else if (c === "star") { const d = this.rows()[this.at]; if (d) this.toggleStar(d); }
    else if (c === "cancel") {
      if (this.query.value()) { this.query.set_value(""); this.at = 0; this.reveal = true; }
      else this.dismiss();
    }
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    const m = e.modifiers;
    const ctrl = m.control && !m.shift && !m.alt && !m.platform;
    const plain = !m.control && !m.shift && !m.alt && !m.platform;
    const c = e.keystroke === "up" || (ctrl && e.key === "k") ? "up"
      : e.keystroke === "down" || (ctrl && e.key === "j") ? "down"
      : plain && e.key === "tab" ? "tab"
      : e.keystroke === "escape" ? "cancel"
      : "";
    if (!c) return;
    this.command(c);
    cx.stop_propagation();
    cx.notify();
  }

  /** @param {Context} _cx */
  render(_cx) {
    const t = colors();
    const mono = settings().font_family;
    const stars = this.stars();
    const rows = this.rows();
    this.at = Math.max(0, Math.min(this.at, rows.length - 1));
    // Category labels while browsing. A search lists best matches first, so it has none.
    const grouped = !this.query.value().trim();

    /** @type {any[]} */
    const children = [];
    let selectedChild = 0;
    let last = "";
    rows.forEach((d, i) => {
      if (grouped && d.cat !== last) {
        children.push(div().pt(children.length ? 8 : 2).pb(2).px(6).text_size(SIZE.small).text_color(t.dim).child(d.cat));
        last = d.cat;
      }
      if (i === this.at) selectedChild = children.length;
      children.push(this.row(t, mono, d, i, stars.has(d.id)));
    });
    if (this.reveal && rows.length) { this.scroll.scroll_to_item(selectedChild); this.reveal = false; }

    const empty = this.tab === "starred" && !stars.size
      ? "Nothing starred yet. Press enter on a row, or click its star."
      : "No command matches.";

    return v_flex().id("vim-docs").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .size_full().p(10).gap(8).bg(t.popover).rounded(12).border_1().border_color(t.border)
      .text_size(12.5).text_color(t.foreground)
      .child(h_flex().flex_none().items_center().gap(6)
        .child(div().flex_1().font_semibold().child("Vim"))
        .child(this.tabButton(t, "all", "All"))
        .child(this.tabButton(t, "starred", `★ ${stars.size}`))
        .child(keep(div().id("vim-docs-close")).px(6).rounded(4).text_color(t.dim).cursor_pointer()
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { cx.stop_propagation(); this.dismiss(); })
          .child("✕")))
      .child(keep(div().id("vim-docs-search").flex_none()).child(Input.new(this.query).h(28).px(8).rounded(6).border_1()
        .border_color(focusBorder(t)).bg(t.background).text_size(12).text_color(t.foreground)))
      .child(keep(v_flex().id("vim-docs-list")).flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll)
        .children(rows.length ? children : [div().p(8).text_color(t.dim).child(empty)]))
      .child(h_flex().flex_none().gap(10).text_size(10.5).text_color(t.dim)
        .child("↑↓ ctrl-j/k move").child("enter star").child("tab starred").child("esc close"));
  }

  /** @param {any} t @param {"all" | "starred"} id @param {string} label */
  tabButton(t, id, label) {
    const on = this.tab === id;
    return keep(div().id(`vim-docs-tab-${id}`)).flex_none().px(8).py(2).rounded(5).text_size(11.5).cursor_pointer()
      .text_color(on ? t.foreground : t.muted).when(on, (el) => el.bg(t.selected))
      .hover((s) => s.bg(on ? t.selected : t.hover))
      .on_click((_e, cx) => { cx.stop_propagation(); this.tab = id; this.at = 0; this.reveal = true; this.query.focus(); cx.notify(); })
      .child(label);
  }

  /**
   * The keys as keycaps: one box per key, fill-ins such as {motion} dim and unboxed, Ex commands
   * such as :wq as one box. Alternatives sit a little apart.
   * @param {any} t @param {string} mono @param {string} keys
   */
  keycaps(t, mono, keys) {
    return h_flex().flex_none().gap(10).items_center().font_family(mono).text_size(11).children(keyParts(keys).map((group) =>
      h_flex().gap(2).items_center().children(group.map((p) => p.kind === "hole"
        ? div().italic().text_color(t.dim).child(p.text)
        : div().px(4).min_w(16).flex().justify_center().rounded(3).border_1().border_color(t.border).bg(t.raised)
          .text_color(t.foreground).child(p.text)))));
  }

  /** One command. The selected row shows its note under it. @param {any} t @param {string} mono @param {Doc} d @param {number} i @param {boolean} starred */
  row(t, mono, d, i, starred) {
    const on = i === this.at;
    return v_flex().id(`vim-docs-row-${i}`).flex_none().px(6).py(3).rounded(5).cursor_pointer()
      .when(on, (el) => el.bg(t.selected)).hover((s) => s.bg(on ? t.selected : t.hover))
      .on_click((_e, cx) => { cx.stop_propagation(); this.at = i; this.query.focus(); cx.notify(); })
      .child(h_flex().gap(6).items_center()
        .child(div().id(`vim-docs-star-${i}`).w(STAR_W).flex_none().text_size(11)
          .text_color(starred ? t.accent : on ? t.dim : t.border).hover((s) => s.text_color(t.accent))
          .on_click((_e, cx) => { cx.stop_propagation(); this.toggleStar(d); cx.notify(); })
          .child(starred ? "★" : "☆"))
        .child(div().flex_1().min_w(0).truncate().text_color(on ? t.foreground : t.muted).child(d.desc))
        .child(this.keycaps(t, mono, d.keys)))
      .when(on && Boolean(d.note), (el) => el.child(div().pl(STAR_W + 6).pt(2).text_size(11).text_color(t.dim).child(d.note ?? "")));
  }
}
