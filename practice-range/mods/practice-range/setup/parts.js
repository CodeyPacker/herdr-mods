// Small pieces the setup pages and the language screen share.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { badge, tag } from "../kit/pane.js";
import { legend } from "../kit/legend.js";
import { SIZE } from "../kit/theme.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @typedef {import("../kit/theme.js").Color} Color */
/** @typedef {import("../languages/types.js").LanguagePack} LanguagePack */

/** A pack's color from the theme, so it follows light and dark themes. @param {Theme} t @param {LanguagePack} pack */
export function packColor(t, pack) {
  return t[pack.color] ?? t.accent;
}

/** A pack's colored square with its short name. @param {Theme} t @param {LanguagePack} pack @param {number} [size] */
export function packBadge(t, pack, size) {
  return badge(pack.short, packColor(t, pack), size);
}

/**
 * A tag for how something stands: ready (green), needs attention (the error color), or neutral.
 * @param {Theme} t @param {string} text @param {"ready" | "needed" | "neutral"} state
 */
export function statusTag(t, text, state) {
  return tag(t, text, state === "ready" ? t.done : state === "needed" ? t.blocked : t.muted);
}

/**
 * The top of a page: a small label, the title, and a sentence that says what to do. The sentence
 * is left out when the layout is compact.
 * @param {Theme} t @param {{ label: string, title: string, intro: string, compact: boolean }} page
 */
export function pageTop(t, { label, title, intro, compact }) {
  return v_flex().gap(4)
    .child(div().text_size(SIZE.small).text_color(t.accent).child(label))
    .child(div().text_size(20).font_semibold().child(title))
    .when(!compact, element => element.child(div().text_color(t.muted).child(intro)));
}

/** A page's scrolling body. @param {string} id */
export function pageBody(id) {
  return v_flex().id(id).flex_1().min_h(0).overflow_y_scrollbar().px(SIZE.panePad + 4).py(16).gap(14);
}

/** Cards side by side that wrap onto more rows when the panel is narrow. Cards in a row share the tallest one's height. */
export function cardGrid() {
  return h_flex().flex_wrap().gap(12).items_stretch();
}

/** One card's share of a grid row: grows to fill it, and wraps below `basis` px. @param {any} card @param {number} [basis] */
export function inGrid(card, basis = 260) {
  return card.flex_grow(1).flex_basis(basis).min_w(0);
}

/** The key hints along a page's bottom. @param {Theme} t @param {import("../kit/legend.js").Hint[]} hints */
export function pageLegend(t, hints) {
  return h_flex().flex_none().px(SIZE.panePad).py(8).border_t_1().border_color(t.border).child(legend(t, hints));
}

/** A card's first row: a badge, a name with a line under it, and a status on the right. @param {Theme} t @param {any} mark @param {string} name @param {string} detail @param {any} status */
export function cardTitle(t, mark, name, detail, status) {
  return h_flex().gap(10).items_center()
    .child(mark)
    .child(v_flex().flex_1().min_w(0).gap(1)
      .child(div().font_semibold().child(name))
      .child(div().text_size(12).text_color(t.muted).child(detail)))
    .child(status);
}
