// A stop's diff: hunk headers, then added and removed lines tinted green and red.
// Clicking a numbered line opens a comment box under it. Saved comments sit under their line.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { settings } from "herdr";
import { commentsOn } from "../comments.js";
import { textInput } from "../ui.js";

function row(r, i, t, onRow) {
  const { kind, number, text } = r;
  const mono = settings().font_family ?? "JetBrains Mono";
  if (kind === "@") return div().font_family(mono).text_size(11.5).w_full().px(12).h(20).flex_none().truncate().bg(t.raised).text_color(t.dim).child(text);
  return h_flex().id(`row-${i}`).font_family(mono).text_size(11.5).w_full().h(20).flex_none().gap(10)
    .when(kind === "+", e => e.bg(t.ansi2 + "18")).when(kind === "-", e => e.bg(t.ansi1 + "18"))
    .when(number !== undefined && Boolean(onRow), e => e.cursor_pointer().hover(s => s.bg(t.hover)).on_click((_e, cx) => { onRow(r, cx); cx.notify(); }))
    .child(div().w(36).flex_none().text_right().text_color(t.dim).child(number === undefined ? "" : String(number)))
    .child(div().w(10).flex_none().text_color(kind === "+" ? t.ansi2 : kind === "-" ? t.ansi1 : t.dim).child(kind.trim()))
    .child(div().flex_1().min_w(0).truncate().child(text));
}

/** A saved comment, indented under its line, with a delete button. */
function bubble(c, t, onDelete) {
  return h_flex().ml(56).mr(10).my(3).px(10).py(6).gap(8).items_start().rounded(7)
    .border_1().border_color(t.accent).bg(t.raised).text_size(12)
    .child(div().flex_1().min_w(0).child(c.text))
    .child(div().id(`del-${c.id}`).flex_none().px(4).rounded(4).text_color(t.dim).cursor_pointer()
      .hover(s => s.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => { onDelete(c, cx); cx.notify(); }).child("×"));
}

/**
 * Scrolls on its own; `id` must change with the stop so each stop starts at the top.
 * `c` holds the comment state: `file`, `list`, `open` (the row being commented on, or
 * null), `input`, and the `onRow` and `onDelete` handlers. Leave it out for a plain diff.
 */
export function diffView(id, rows, t, c = null) {
  const items = [];
  rows.forEach((r, i) => {
    items.push(row(r, i, t, c?.onRow));
    if (!c) return;
    for (const saved of commentsOn(c.list, c.file, r)) items.push(bubble(saved, t, c.onDelete));
    if (c.open && c.open.line === r.number && c.open.side === (r.kind === "-" ? "old" : "new"))
      items.push(div().ml(56).mr(10).my(4).child(textInput(t, c.input, true)));
  });
  return v_flex().id(id).size_full().overflow_y_scrollbar().py(4)
    .children(items);
}
