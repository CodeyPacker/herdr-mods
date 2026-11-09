// A stop's diff: hunk headers, then added and removed lines tinted green and red.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { settings } from "herdr";

function row({ kind, number, text }, t) {
  if (kind === "@") return div().w_full().px(12).h(20).flex_none().truncate().bg(t.raised).text_color(t.dim).child(text);
  return h_flex().w_full().h(20).flex_none().gap(10)
    .when(kind === "+", e => e.bg(t.ansi2 + "18")).when(kind === "-", e => e.bg(t.ansi1 + "18"))
    .child(div().w(36).flex_none().text_right().text_color(t.dim).child(number === undefined ? "" : String(number)))
    .child(div().w(10).flex_none().text_color(kind === "+" ? t.ansi2 : kind === "-" ? t.ansi1 : t.dim).child(kind.trim()))
    .child(div().flex_1().min_w(0).truncate().child(text));
}

/** Scrolls on its own; `id` must change with the stop so each stop starts at the top. */
export function diffView(id, rows, t) {
  return v_flex().id(id).size_full().overflow_y_scrollbar().py(4)
    .font_family(settings().font_family ?? "JetBrains Mono").text_size(11.5)
    .children(rows.map(r => row(r, t)));
}
