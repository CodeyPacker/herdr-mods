// One tour stop: header, the code excerpt, the explanation, and the key bar.
import { div } from "gpui-kit";
import { v_flex, h_flex, Editor, TextView, h_resizable, v_resizable, resizable_panel } from "gpui-base";
import { settings } from "herdr";
import { button, spinner, textInput } from "../ui.js";
import { diffView } from "./diff.js";

/** `v` is the Tourist view: its state is read here and its methods run on clicks. */
export function tourView(v, t) {
  const plan = v.plan, s = plan.stops[v.idx], last = plan.stops.length - 1;
  const header = h_flex().px(14).py(10).gap(10).items_center().border_b_1().border_color(t.border)
    .child(div().text_size(11.5).text_color(t.dim).child(`${v.idx + 1} / ${plan.stops.length}`))
    .when(Boolean(s.group), el => el.child(div().flex_none().max_w(180).truncate().px(6).py(1).rounded(5).bg(t.raised)
      .text_size(11).text_color(t.accent).child(String(s.group))))
    .child(div().flex_1().min_w(0).truncate().font_semibold().child(s.title))
    .child(div().max_w(200).truncate().text_size(11.5).text_color(t.dim).child(plan.title ?? ""));
  const fileLine = h_flex().id("file").px(14).py(6).gap(8).items_center().cursor_pointer()
    .hover(st => st.bg(t.hover)).on_click(() => v.openInEditor())
    .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.accent).font_family(settings().font_family).child(s.file))
    .child(div().text_size(11.5).text_color(t.dim).child(v.pr
      ? `lines ${s.start}–${s.end}  ·  click a line to comment${v.comments.length ? ` (${v.comments.length} saved)` : ""}  ·  o opens the PR`
      : `lines ${s.start}–${s.end}  ·  o opens`));
  // On PR tours each diff line takes a comment.
  const comments = v.pr ? {
    file: s.file, list: v.comments, input: v.commentInput,
    open: v.commenting?.file === s.file ? v.commenting : null,
    onRow: (r, cx) => v.startComment(r, cx), onDelete: (c, cx) => v.deleteComment(c, cx),
  } : null;
  const code = div().flex_1().min_h(0).mx(14).mb(4).rounded(8).border_1().border_color(t.border).bg(t.background).overflow_hidden()
    .child(v.diff ? diffView(`diff-${v.idx}`, v.diff, t, comments)
      : v.code ? Editor.new(v.code).size_full()
      : div().p(10).text_size(12).text_color(t.dim).child(v.codeError ?? "Loading…"));
  const notes = s.notes.map((n, i) => v_flex().gap(4).pt(6).border_t_1().border_color(t.border)
    .child(div().text_size(11.5).font_semibold().text_color(t.accent).child(n.label))
    .child(TextView.markdown(`note-${v.idx}-${i}`, n.text).selectable()));
  // Cap the line length so long explanations stay readable in wide panes.
  const body = v_flex().w_full().max_w(680).gap(10)
    .when(v.idx === 0 && Boolean(plan.summary), el => el.child(v_flex().p(10).rounded(8).bg(t.raised)
      .child(TextView.markdown("summary", String(plan.summary)).selectable())))
    .child(TextView.markdown(`body-${v.idx}`, String(s.body ?? "")).selectable())
    .children(notes)
    .when(Boolean(v.busy), el => el.child(h_flex().gap(8).items_center().text_color(t.dim)
      .child(spinner(t))
      .child(div().text_size(12).child(`${v.busy}…`))));
  const explain = v_flex().id(`explain-${v.idx}`).flex_1().min_h(0).overflow_y_scrollbar().px(14).py(12).child(body);
  // The ask box is only drawn while asking, so tour keys can never land in it.
  const ask = div().px(14).pb(8).child(textInput(t, v.input, true));
  const free = !v.busy;
  const bar = h_flex().px(14).py(10).gap(6).flex_wrap().border_t_1().border_color(t.border)
    .child(button(t, "prev", "Back", "b", v.idx > 0, (_e, cx) => { v.show(v.idx - 1, cx); cx.notify(); }))
    .child(button(t, "next", v.idx === last ? "Last stop" : "Next", "n", v.idx < last, (_e, cx) => { v.show(v.idx + 1, cx); cx.notify(); }))
    .child(button(t, "deeper", "Deeper", "d", free, (_e, cx) => { v.deeper(cx); cx.notify(); }))
    .child(button(t, "tech", "More technical", "t", free, (_e, cx) => { v.technical(cx); cx.notify(); }))
    .child(button(t, "askbtn", "Ask", "a", free, (_e, cx) => { v.startAsking(cx); cx.notify(); }))
    .when(Boolean(v.pr), el => el.child(button(t, "review", `Post review (${v.comments.length})`, "r",
      v.comments.length > 0, (_e, cx) => { v.startReview(cx); cx.notify(); })))
    .when(Boolean(v.pr?.mine), el => el.child(button(t, "fix",
      v.fix?.phase === "running" ? "Fixing…" : v.fix && v.fix.phase !== "pushed" ? "View fix" : `Fix ${v.comments.length} comment${v.comments.length === 1 ? "" : "s"}`,
      "f", Boolean(v.fix && v.fix.phase !== "pushed") || (v.comments.length > 0 && free), (_e, cx) => { v.startFix(cx); cx.notify(); })))
    .child(button(t, "layout", v.isSplit() ? "Stacked" : "Split", "s", true, (_e, cx) => { v.toggleSplit(); cx.notify(); }))
    .child(button(t, "restart", "New tour", "q", true, (_e, cx) => { v.reset(cx); cx.notify(); }));
  // Code and explanation sit in a resizable group: drag the line between them.
  // The group remembers each layout's sizes under its id.
  const codeSide = v_flex().size_full().min_h(0).child(fileLine).child(code);
  const textSide = v_flex().size_full().min_h(0).child(explain).when(v.asking, el => el.child(ask));
  // The group keeps the first size it sees and then whatever the user drags to, so start from a
  // fixed height rather than one measured before the code has loaded.
  const panes = v.isSplit()
    ? h_resizable("tour-split").size_full()
      .child(resizable_panel().size(560).size_range(200).child(codeSide.pb(8)))
      .child(resizable_panel().size_range(240).child(textSide))
    : v_resizable("tour-stack").size_full()
      .child(resizable_panel().size(360).size_range(80).child(codeSide))
      .child(resizable_panel().size_range(80).child(textSide));
  return v_flex().flex_1().min_h(0).child(header)
    .child(div().flex_1().min_h(0).child(panes)).child(bar);
}
