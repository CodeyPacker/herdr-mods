// The post-review screen: your comments, the verdict, an optional summary, and a
// two-press post to GitHub.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { settings } from "herdr";
import { button, option, spinner, textInput } from "../ui.js";
import { eventsFor, DEFAULT_SUMMARY } from "../review.js";
import { linesOf } from "../comments.js";

/** `v` is the Tourist view: its state is read here and its methods run on clicks. */
export function reviewView(v, t) {
  const r = v.review, pr = v.pr, events = eventsFor(pr);
  const banner = (text, color) => div().p(10).rounded(8).bg(t.raised).text_size(12).text_color(color).child(text);
  const section = (title) => div().pt(10).pb(4).text_size(11.5).text_color(t.dim).child(title);
  const header = h_flex().px(14).py(10).gap(10).items_center().border_b_1().border_color(t.border)
    .child(div().font_semibold().child(`Post review on PR #${pr.number}`))
    .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim)
      .child(`by ${pr.author} · posting as ${pr.me || "the gh account"} · ${v.comments.length} comment${v.comments.length === 1 ? "" : "s"}`));
  const comments = v.comments.map(c => v_flex().gap(2).px(10).py(6).rounded(7).bg(t.raised)
    .child(div().text_size(11.5).text_color(t.accent).font_family(settings().font_family).truncate()
      .child(`${c.file}:${linesOf(c)}${c.startLine === undefined && c.side === "old" ? " (removed line)" : ""}`))
    .child(div().text_size(12.5).child(c.text)));
  const pick = (i) => (_e, cx) => { v.leaveBox(); r.cursor = i; r.confirm = false; cx.notify(); };
  const content = v_flex().gap(6).max_w(720)
    .when(Boolean(r.error), el => el.child(banner(r.error, t.ansi1)))
    .when(r.phase === "posted", el => el.child(banner(`Posted to GitHub. o opens it. The comments were cleared.`, t.ansi2)))
    .when(r.phase !== "posted", el => el
      .child(section(comments.length ? "Your comments, posted on the lines they sit on" : "No line comments. You can approve, or write a summary to comment."))
      .children(comments)
      .child(section(pr.mine ? "Verdict (your own PR can only take comments) · p posts" : "Verdict · pick one, then p posts"))
      .children(events.map((e, i) => option(t, `event-${e.id}`, e.key, e.label, e.hint, r.cursor === i, pick(i))))
      .child(section(v.comments.length ? `Summary (optional, tab types; empty posts "${DEFAULT_SUMMARY}")` : "Summary (optional, tab types)"))
      .child(textInput(t, v.summaryInput, v.typing === "summary")));
  const body = r.phase === "posting"
    ? v_flex().flex_1().items_center().justify_center().gap(8).child(spinner(t).text_size(22)).child(div().child("Posting the review…"))
    : v_flex().id("review-body").flex_1().min_h(0).overflow_y_scrollbar().px(14).py(12).child(content);
  const event = events[r.cursor] ?? events[0];
  const bar = h_flex().px(14).py(10).gap(6).flex_wrap().border_t_1().border_color(t.border)
    .child(button(t, "review-back", "Back to tour", "b", r.phase !== "posting", (_e, cx) => { v.closeReview(); cx.notify(); }))
    .when(r.phase === "posted", el => el.child(button(t, "review-open", "Open on GitHub", "o", true, (_e, cx) => { v.openReview(); cx.notify(); })))
    .when(r.phase !== "posted", el => el.child(button(t, "review-post",
      `Post as ${event.label}`,
      "p", v.canPost(), (_e, cx) => { v.postReview(cx); cx.notify(); })));
  return v_flex().flex_1().min_h(0).child(header).child(body).child(bar);
}
