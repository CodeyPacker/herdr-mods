// The checks screen (PR tours): the PR's CI checks, failures first. A failed GitHub Actions
// check can be explained: the agent reads the end of its log and says why it failed.
import { div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { button, spinner } from "../ui.js";
import { checkCounts, actionsJob } from "../checks.js";

const MARK = { pass: "✓", fail: "✗", cancel: "✗", pending: "●", skipping: "–" };

/** `v` is the Tourist view: its state is read here and its methods run on clicks. */
export function checksView(v, t) {
  const c = v.checks, pr = v.pr, list = c.list ?? [];
  const color = b => b === "pass" ? t.ansi2 : b === "fail" || b === "cancel" ? t.ansi1 : b === "pending" ? t.ansi3 : t.dim;
  const n = checkCounts(list);
  const header = h_flex().px(14).py(10).gap(10).items_center().border_b_1().border_color(t.border)
    .child(div().font_semibold().child(`Checks on PR #${pr.number}`))
    .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim)
      .child(c.list ? `${n.fail} failing · ${n.pending} running · ${n.pass} passed · at ${pr.headOid.slice(0, 7)}` : ""))
    .when(c.loading, el => el.child(spinner(t)));
  const cur = v.currentCheck();
  const rows = list.map((x, i) => {
    const on = c.cursor === i;
    return h_flex().id(`check-${i}`).gap(10).px(10).py(6).rounded(7).items_center().cursor_pointer()
      .when(on, el => el.bg(t.selected)).hover(st => st.bg(t.hover))
      .on_click((_e, cx) => { c.cursor = i; cx.notify(); })
      .child(div().w(14).flex_none().text_color(color(x.bucket)).child(MARK[x.bucket] ?? "?"))
      .child(v_flex().flex_1().min_w(0)
        .child(div().truncate().child(x.workflow ? `${x.workflow} / ${x.name}` : x.name))
        .when(Boolean(x.description), el => el.child(div().truncate().text_size(11.5).text_color(t.dim).child(x.description))))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(i < 9 ? String(i + 1) : ""));
  });
  const failed = cur && (cur.check.bucket === "fail" || cur.check.bucket === "cancel");
  const notes = cur ? (c.notes[cur.key] ?? []).map((note, i) => v_flex().gap(4).pt(6).border_t_1().border_color(t.border)
    .child(div().text_size(11.5).font_semibold().text_color(note.label === "Error" ? t.ansi1 : t.accent).child(note.label))
    .child(TextView.markdown(`check-note-${cur.key}-${i}`, note.text).selectable())) : [];
  const empty = text => div().px(10).py(7).text_size(12).text_color(t.dim).child(text);
  const content = v_flex().gap(4).max_w(720)
    .when(Boolean(c.error), el => el.child(div().p(10).rounded(8).bg(t.raised).text_size(12).text_color(t.ansi1).child(c.error)))
    .when(!c.list && !c.error, el => el.child(empty("Loading checks…")))
    .when(Boolean(c.list) && list.length === 0, el => el.child(empty("This PR has no checks.")))
    .children(rows)
    .when(Boolean(failed) && notes.length === 0 && !v.busy, el => el.child(div().pt(8).text_size(12).text_color(t.dim)
      .child(actionsJob(cur.check.link) ? "e asks why it failed: the agent reads the end of its log." : "This check doesn't run on GitHub Actions. o opens it.")))
    .when(notes.length > 0, el => el.child(v_flex().pt(8).gap(10).children(notes)))
    .when(Boolean(v.busy), el => el.child(h_flex().pt(8).gap(8).items_center().text_color(t.dim)
      .child(spinner(t)).child(div().text_size(12).child(`${v.busy}…`))));
  const body = v_flex().id("checks-body").flex_1().min_h(0).overflow_y_scrollbar().px(14).py(12).child(content);
  const bar = h_flex().px(14).py(10).gap(6).flex_wrap().border_t_1().border_color(t.border)
    .child(button(t, "checks-back", "Back to tour", "b", true, (_e, cx) => { v.closeChecks(); cx.notify(); }))
    .child(button(t, "checks-explain", "Why it failed", "e", Boolean(failed) && !v.busy && Boolean(actionsJob(cur?.check.link)), (_e, cx) => { v.explainCheck(cx); cx.notify(); }))
    .child(button(t, "checks-open", "Open", "o", Boolean(cur?.check.link), (_e, cx) => { v.openCheck(); cx.notify(); }))
    .child(button(t, "checks-refresh", "Refresh", "r", !c.loading, (_e, cx) => { v.loadChecks(cx); cx.notify(); }));
  return v_flex().flex_1().min_h(0).child(header).child(body).child(bar);
}
