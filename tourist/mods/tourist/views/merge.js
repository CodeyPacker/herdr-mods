// The merge screen, for your own PRs: pick a merge method, press m, then y to confirm.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { button, option, spinner } from "../ui.js";

/** `v` is the Tourist view: its state is read here and its methods run on clicks. */
export function mergeView(v, t) {
  const m = v.merge, pr = v.pr, methods = m.methods ?? [];
  const banner = (text, color) => div().p(10).rounded(8).bg(t.raised).text_size(12).text_color(color).child(text);
  const header = h_flex().px(14).py(10).gap(10).items_center().border_b_1().border_color(t.border)
    .child(div().font_semibold().child(`Merge PR #${pr.number}`))
    .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(`${pr.head} into ${pr.base}`));
  const pick = i => (_e, cx) => { v.moveMethod(i); cx.notify(); };
  let body;
  if (m.phase === "loading" || m.phase === "merging") {
    body = v_flex().flex_1().items_center().justify_center().gap(8)
      .child(spinner(t).text_size(22))
      .child(div().child(m.phase === "loading" ? "Reading the repo's merge settings…" : `Merging into ${pr.base}…`));
  } else {
    const content = v_flex().gap(6).max_w(720)
      .when(Boolean(m.error), el => el.child(banner(m.error, t.ansi1)))
      .when(m.phase === "merged", el => el.child(banner(`Merged into ${pr.base}. o opens the PR.`, t.ansi2)))
      .when(m.phase === "picking", el => el
        .child(div().pb(4).text_size(11.5).text_color(t.dim).child("How to merge (only the methods this repo allows)"))
        .children(methods.map((x, i) => option(t, `merge-${x.id}`, x.key, x.label, x.hint, m.cursor === i, pick(i))))
        .child(div().pt(8).text_size(11.5).text_color(t.dim)
          .child(`Merges only if the PR's head is still the commit you reviewed. GitHub's own rules (checks, reviews, conflicts) still apply.`)));
    body = v_flex().id("merge-body").flex_1().min_h(0).overflow_y_scrollbar().px(14).py(12).child(content);
  }
  const method = methods[m.cursor];
  const bar = h_flex().px(14).py(10).gap(6).flex_wrap().border_t_1().border_color(t.border)
    .child(button(t, "merge-back", "Back to tour", "b", m.phase !== "merging", (_e, cx) => { v.closeMerge(); cx.notify(); }))
    .when(m.phase === "merged", el => el.child(button(t, "merge-open", "Open on GitHub", "o", true, (_e, cx) => { v.openPR(); cx.notify(); })))
    .when(m.phase === "picking", el => el.child(button(t, "merge-go",
      method?.label ?? "Merge",
      "m", Boolean(method), (_e, cx) => { v.doMerge(cx); cx.notify(); })));
  return v_flex().flex_1().min_h(0).child(header).child(body).child(bar);
}
