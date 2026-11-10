// A stop's diff: hunk headers, then added and removed lines tinted green and red.
// Clicking a numbered line opens a comment box under it; shift-clicking another line in the
// same hunk turns it into a multi-line comment. Saved comments sit under their last line, and
// the lines a multi-line comment covers get an accent bar on the left.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { settings } from "herdr";
import { commentsOn, coveredRows, linesOf } from "../comments.js";
import { textInput } from "../ui.js";

function row(r, i, id, t, onRow, covered) {
  const { kind, number, text } = r;
  const mono = settings().font_family ?? "JetBrains Mono";
  if (kind === "@") return div().font_family(mono).text_size(11.5).w_full().px(12).h(20).flex_none().whitespace_nowrap().bg(t.raised).text_color(t.dim).child(text);
  return h_flex().id(id).font_family(mono).text_size(11.5).w_full().h(20).flex_none().gap(10)
    .when(kind === "+", e => e.bg(t.ansi2 + "18")).when(kind === "-", e => e.bg(t.ansi1 + "18"))
    .border_l_2().border_color(covered ? t.accent : "#00000000")
    .when(number !== undefined && Boolean(onRow), e => e.cursor_pointer().hover(s => s.bg(t.hover))
      .on_click((ev, cx) => { onRow(r, cx, { index: i, shift: Boolean(ev?.modifiers?.shift) }); cx.notify(); }))
    .child(div().w(36).flex_none().text_right().text_color(t.dim).child(number === undefined ? "" : String(number)))
    .child(div().w(10).flex_none().text_color(kind === "+" ? t.ansi2 : kind === "-" ? t.ansi1 : t.dim).child(kind.trim()))
    .child(div().flex_none().pr(12).whitespace_nowrap().child(text.replace(/\t/g, "    ")));
}

// Roughly one monospace character at 11.5 px, used to size the scroll area to the longest line.
const CHAR_WIDTH = 7;
const GUTTER = 80; // line number, +/− mark and gaps

/** One of your comments, indented under its line: click the text to edit it, × to delete it. */
function bubble(c, t, onDelete, onEdit) {
  return h_flex().ml(56).mr(10).my(3).max_w(640).px(10).py(6).gap(8).items_start().rounded(7)
    .border_1().border_color(t.accent).bg(t.raised).text_size(12)
    .child(div().id(`edit-${c.id}`).flex_1().min_w(0).cursor_pointer().on_click((_e, cx) => { onEdit(c, cx); cx.notify(); })
      .when(c.startLine !== undefined, el => el.child(div().text_size(11).text_color(t.dim).child(`Lines ${linesOf(c)}`)))
      .child(c.text))
    .child(div().id(`del-${c.id}`).flex_none().px(4).rounded(4).text_color(t.dim).cursor_pointer()
      .hover(s => s.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => { onDelete(c, cx); cx.notify(); }).child("×"));
}

/** A thread already on GitHub: read-only, the first comment then its replies. */
function thread(th, t) {
  return v_flex().ml(56).mr(10).my(3).max_w(640).px(10).py(6).gap(6).rounded(7)
    .border_1().border_color(t.border).bg(t.raised).text_size(12)
    .when(th.startLine !== undefined, el => el.child(div().text_size(11).text_color(t.dim).child(`Lines ${linesOf(th)} · on GitHub`)))
    .children(th.comments.map((m, i) => v_flex().gap(1).when(i > 0, el => el.pl(10).border_l_2().border_color(t.border))
      .child(div().text_size(11).font_semibold().text_color(t.muted).child(`${m.author}${i === 0 && th.startLine === undefined ? " · on GitHub" : ""}`))
      .child(div().child(m.body))));
}

/** The diff rows of one file with a sideways scroll of their own, for stacking several in one list. */
export function diffBlock(id, rows, t, c = null) {
  const items = [];
  const covered = c ? coveredRows(rows, c.list, c.file, c.open) : new Set();
  rows.forEach((r, i) => {
    items.push(row(r, i, `${id}-row-${i}`, t, c?.onRow, covered.has(i)));
    if (!c) return;
    for (const th of commentsOn(c.threads ?? [], c.file, r)) items.push(thread(th, t));
    // The comment being edited shows as the box below instead.
    for (const saved of commentsOn(c.list, c.file, r)) if (saved.id !== c.open?.editId) items.push(bubble(saved, t, c.onDelete, c.onEdit));
    if (c.open && c.open.line === r.number && c.open.side === (r.kind === "-" ? "old" : "new"))
      items.push(div().ml(56).mr(10).my(4).max_w(640).child(textInput(t, c.input, true)));
  });
  // Long lines scroll sideways instead of being cut off.
  const longest = rows.reduce((n, r) => Math.max(n, r.text.replace(/\t/g, "    ").length), 0);
  return div().id(`${id}-x`).w_full().overflow_x_scrollbar()
    .child(v_flex().w_full().min_w(GUTTER + longest * CHAR_WIDTH).children(items));
}

/**
 * One file's diff that scrolls on its own; `id` must change with the stop so each stop
 * starts at the top. The sideways scroll sits inside the vertical one, so the vertical
 * scrollbar stays at the panel's right edge. `c` holds the comment state: `file`, `list`,
 * `open` (the row being commented on, or null), `input`, `threads` (GitHub's, read-only), and the
 * `onRow`, `onDelete` and `onEdit` handlers. Leave it out for a plain diff.
 */
export function diffView(id, rows, t, c = null) {
  return v_flex().id(id).size_full().overflow_y_scrollbar().py(4).child(diffBlock(id, rows, t, c));
}
