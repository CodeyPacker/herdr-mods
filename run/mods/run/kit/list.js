// List rows: the row shell with its selected highlight, and the note a list shows when it has no rows.
import { h_flex } from "gpui-base";
import { SIZE } from "./theme.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("./theme.js").Theme} Theme */

/**
 * A row's shell. Add its columns with `.child(...)` or `.children(...)`.
 * @param {Theme} t
 * @param {{ id: string, on: boolean, click: (cx: Context) => void, compact?: boolean }} r
 *   `on`: this row is selected. `compact`: the tighter height, for long lists.
 */
export function listRow(t, r) {
  return h_flex().id(r.id).w_full().h(r.compact ? SIZE.compactRow : SIZE.row).flex_none().px(12).gap(10).items_center()
    .rounded(SIZE.rowRadius).cursor_pointer().text_size(SIZE.text)
    .when(r.on, (el) => el.bg(t.selected))
    .hover((s) => s.bg(r.on ? t.selected : t.hover))
    .on_click((_e, cx) => r.click(cx));
}

/** One dim line in place of rows: "nothing here", an error, or a spinner. @param {Theme} t @param {any} child */
export function listNote(t, child) {
  return h_flex().px(12).py(10).gap(8).items_center().text_size(13).text_color(t.dim).child(child);
}
