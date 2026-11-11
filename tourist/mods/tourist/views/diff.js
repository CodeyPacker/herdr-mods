// A stop's diff: hunk headers, then added and removed lines tinted green and red.
// Clicking a numbered line opens a comment box under it; shift-clicking another line in the
// same hunk turns it into a multi-line comment. Saved comments sit under their last line, and
// the lines a multi-line comment covers get an accent bar on the left.
// A tour stop shows the file's whole diff: the stop's own lines have accent line numbers, every
// stop on the file gets a label above its first line, and lines a link points at are highlighted.
import { div } from "gpui-kit";
import { v_flex, h_flex, Scrollbar } from "gpui-base";
import { settings } from "herdr";
import { commentsOn, coveredRows, linesOf } from "../comments.js";
import { textInput, spinner } from "../ui.js";

/** One diff line. `mark` is { covered, stop, linked }: under a multi-line comment, in the current stop, pointed at by a link. */
function row(r, i, id, t, onRow, mark = {}) {
  const { kind, number, text } = r;
  const { covered, stop, linked } = mark;
  const mono = settings().font_family ?? "JetBrains Mono";
  if (kind === "@") return div().font_family(mono).text_size(11.5).w_full().px(12).h(20).flex_none().whitespace_nowrap().bg(t.raised).text_color(t.dim).child(text);
  return h_flex().id(id).font_family(mono).text_size(11.5).w_full().h(20).flex_none().gap(10)
    .when(kind === "+", e => e.bg(t.ansi2 + "18")).when(kind === "-", e => e.bg(t.ansi1 + "18"))
    .when(Boolean(linked), e => e.bg(t.selected))
    .border_l_2().border_color(covered ? t.accent : "#00000000")
    .when(number !== undefined && !r.noComment && Boolean(onRow), e => e.cursor_pointer().hover(s => s.bg(t.hover))
      .on_click((ev, cx) => { onRow(r, cx, { index: i, shift: Boolean(ev?.modifiers?.shift) }); cx.notify(); }))
    .child(div().w(36).flex_none().text_right().when(Boolean(stop), e => e.bg(t.raised).font_semibold())
      .text_color(stop ? t.accent : t.dim).child(number === undefined ? "" : String(number)))
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

/** A small clickable word under a thread. */
function action(t, id, label, click) {
  return div().id(id).text_color(t.accent).cursor_pointer().hover(st => st.text_color(t.foreground))
    .on_click((_e, cx) => { click(cx); cx.notify(); }).child(label);
}

/**
 * A thread already on GitHub: the first comment then its replies, with Reply and Resolve under
 * them. A resolved thread folds to one line until clicked.
 */
function thread(th, t, c) {
  const busy = c.threadBusy?.id === th.id, error = c.threadError?.id === th.id ? c.threadError.text : null;
  const box = v_flex().ml(56).mr(10).my(3).max_w(640).px(10).py(6).gap(6).rounded(7)
    .border_1().border_color(t.border).bg(t.raised).text_size(12);
  if (th.resolved && !c.openResolved.has(th.id)) {
    const first = th.comments[0];
    return box.id(`th-${th.id}`).cursor_pointer().hover(st => st.bg(t.hover))
      .on_click((_e, cx) => { c.onExpand(th); cx.notify(); })
      .child(div().truncate().text_size(11.5).text_color(t.dim)
        .child(`Resolved · ${first.author}: ${first.body.split("\n")[0]}`));
  }
  const free = !c.threadBusy;
  const actions = h_flex().gap(12).text_size(11.5)
    .when(free && th.canReply !== false, el => el.child(action(t, `th-reply-${th.id}`, "Reply", cx => c.onReply(th, cx))))
    .when(free && Boolean(th.nodeId) && (th.resolved ? th.canUnresolve : th.canResolve), el => el
      .child(action(t, `th-resolve-${th.id}`, th.resolved ? "Unresolve" : "Resolve", cx => c.onResolve(th, cx))))
    .when(th.resolved, el => el.child(action(t, `th-fold-${th.id}`, "Fold", () => c.onExpand(th))))
    .when(busy, el => el.child(h_flex().gap(6).text_color(t.dim).child(spinner(t)).child(`${c.threadBusy.note}…`)));
  return box
    .when(th.startLine !== undefined || th.resolved, el => el.child(div().text_size(11).text_color(t.dim)
      .child([th.startLine !== undefined ? `Lines ${linesOf(th)}` : "", th.resolved ? "Resolved" : "", "on GitHub"].filter(Boolean).join(" · "))))
    .children(th.comments.map((m, i) => v_flex().gap(1).when(i > 0, el => el.pl(10).border_l_2().border_color(t.border))
      .child(div().text_size(11).font_semibold().text_color(t.muted)
        .child(`${m.author}${i === 0 && th.startLine === undefined && !th.resolved ? " · on GitHub" : ""}`))
      .child(div().child(m.body))))
    .when(Boolean(error), el => el.child(div().text_size(11.5).text_color(t.ansi1).child(error)))
    .when(c.threadReply === th.id, el => el.child(textInput(t, c.threadInput, true)))
    .when(c.threadReply !== th.id, el => el.child(actions));
}

/** A label above a stop's first line: "Stop 2 · title". Click goes to that stop. */
function stopLabel(st, id, t, onStop) {
  return h_flex().id(id).ml(56).mt(6).mb(2).gap(6).items_center().text_size(11)
    .when(!st.current, el => el.cursor_pointer().on_click((_e, cx) => { onStop(st.index, cx); cx.notify(); }))
    .child(div().px(6).py(1).rounded(5).bg(st.current ? t.accent : t.raised).text_color(st.current ? t.accent_foreground : t.accent)
      .child(`Stop ${st.index + 1}`))
    .child(div().text_color(st.current ? t.foreground : t.dim).child(st.current ? `${st.title} · this stop` : st.title));
}

/**
 * The rows with everything that sits between them: stop labels, threads, comments and the
 * comment box. Returns the items, which item each row is (`at[rowIndex]`), and the width the
 * longest line needs. `m` holds the stop marks: `stops` ([{ index, title, row, current }]),
 * `stopRows` and `linkRows` ([first, last] row indexes, or null) and `onStop`.
 */
function diffItems(id, rows, t, c, m) {
  const items = [], at = [];
  const covered = c ? coveredRows(rows, c.list, c.file, c.open) : new Set();
  const inside = (range, i) => Boolean(range) && i >= range[0] && i <= range[1];
  rows.forEach((r, i) => {
    for (const st of m?.stops ?? []) if (st.row === i) items.push(stopLabel(st, `${id}-stop-${st.index}`, t, m.onStop));
    at[i] = items.length;
    items.push(row(r, i, `${id}-row-${i}`, t, c?.onRow, { covered: covered.has(i), stop: inside(m?.stopRows, i), linked: inside(m?.linkRows, i) }));
    if (!c) return;
    for (const th of commentsOn(c.threads ?? [], c.file, r)) items.push(thread(th, t, c));
    // The comment being edited shows as the box below instead.
    for (const saved of commentsOn(c.list, c.file, r)) if (saved.id !== c.open?.editId) items.push(bubble(saved, t, c.onDelete, c.onEdit));
    if (c.open && c.open.line === r.number && c.open.side === (r.kind === "-" ? "old" : "new"))
      items.push(div().ml(56).mr(10).my(4).max_w(640).child(textInput(t, c.input, true)));
  });
  const longest = rows.reduce((n, r) => Math.max(n, r.text.replace(/\t/g, "    ").length), 0);
  return { items, at, width: GUTTER + longest * CHAR_WIDTH };
}

/** The diff rows of one file with a sideways scroll of their own, for stacking several in one list. */
export function diffBlock(id, rows, t, c = null) {
  const { items, width } = diffItems(id, rows, t, c, null);
  // Long lines scroll sideways instead of being cut off.
  return div().id(`${id}-x`).w_full().overflow_x_scrollbar()
    .child(v_flex().w_full().min_w(width).children(items));
}

/**
 * One file's diff that scrolls on its own, both ways; `id` must change with the stop. Rows are
 * the scroll area's direct children, so `scroll` ({ handle, row, step }) can bring a row into
 * view: step 1 jumps to the end, step 2 then scrolls back up just far enough that the row sits
 * at the top. `c` holds the comment state: `file`, `list`, `open` (the row being commented on, or
 * null), `input`, `threads` (GitHub's), and the `onRow`, `onDelete` and `onEdit` handlers. Threads
 * also need `threadReply`, `threadInput`, `threadBusy`, `threadError`, `openResolved`, and the
 * `onReply`, `onResolve` and `onExpand` handlers. Leave it out for a plain diff. `m` holds the
 * stop marks (see diffItems).
 */
export function diffView(id, rows, t, c = null, m = null, scroll = null) {
  const { items, at, width } = diffItems(id, rows, t, c, m);
  if (scroll && items.length) {
    if (scroll.step === 1) scroll.handle.scroll_to_item(items.length - 1);
    else if (scroll.step === 2) scroll.handle.scroll_to_item(at[Math.max(0, Math.min(scroll.row, rows.length - 1))] ?? 0);
  }
  // A plain scroll area driven by the handle, with the scrollbars drawn over it, the same way
  // the explanation scrolls. A built-in scrollbar area keeps a scroll position of its own.
  const area = v_flex().id(id).size_full().overflow_scroll().py(4)
    .children(items.map(item => div().min_w(width).flex_none().child(item)));
  return div().relative().size_full()
    .child(scroll ? area.track_scroll(scroll.handle) : area)
    .child(Scrollbar.new(id).absolute().inset_0());
}
