// The fix screen: the agent working through your comments in a worktree, then what it
// changed, with reply, push and discard. A reply goes into the same agent session, which
// keeps editing the same worktree.
import { div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { settings } from "herdr";
import { button, spinner, textInput } from "../ui.js";
import { diffBlock } from "./diff.js";

/** `v` is the Tourist view: its state is read here and its methods run on clicks. */
export function fixView(v, t) {
  const f = v.fix, pr = v.pr;
  const banner = (text, color) => div().p(10).rounded(8).bg(t.raised).text_size(12).text_color(color).child(text);
  const header = h_flex().px(14).py(10).gap(10).items_center().border_b_1().border_color(t.border)
    .child(div().font_semibold().child(`Fix for PR #${pr.number}`))
    .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(`${f.count} comment${f.count === 1 ? "" : "s"} · worktree ${f.path ?? "…"}`));
  let body;
  if (f.phase === "running" && !f.summary) {
    body = v_flex().flex_1().items_center().justify_center().gap(8).p(24)
      .child(spinner(t).text_size(22))
      .child(div().font_medium().child(`${f.note}…`))
      .child(div().text_size(11.5).text_color(t.dim).child("Edits happen in a separate worktree. Your checkout is not touched."))
      .child(div().pt(6).text_size(11.5).text_color(t.dim).child("b goes back to the tour while it works"));
  } else {
    const files = f.files ?? [];
    const content = v_flex().gap(12)
      .when(Boolean(f.error), el => el.child(banner(f.error, t.ansi1)))
      .when(f.phase === "pushing", el => el.child(banner(`Pushing to origin/${pr.head}…`, t.dim)))
      .when(f.phase === "pushed", el => el.child(banner(`Pushed to origin/${pr.head}. The worktree was removed and the comments were cleared.`, t.ansi2)))
      .when(Boolean(f.summary), el => el.child(v_flex().max_w(680).child(TextView.markdown("fix-summary", String(f.summary)).selectable())))
      .children((f.replies ?? []).map((r, i) => v_flex().gap(6).max_w(680)
        .child(div().p(10).rounded(8).bg(t.raised).text_size(12).child(`You replied: ${r.text}`))
        .when(Boolean(r.answer), el => el.child(TextView.markdown(`fix-reply-${i}`, String(r.answer)).selectable()))))
      .when(f.phase === "running", el => el.child(h_flex().gap(8).items_center().text_color(t.dim)
        .child(spinner(t)).child(div().text_size(12).child(`${f.note}…`))))
      .when(f.phase === "ready" && files.length === 0, el => el.child(div().text_size(12).text_color(t.dim).child("The agent made no changes.")))
      .children(files.map((file, i) => v_flex().rounded(8).border_1().border_color(t.border).bg(t.background).overflow_hidden()
        .child(div().px(12).py(6).border_b_1().border_color(t.border).text_size(12).text_color(t.accent).font_family(settings().font_family).child(file.file))
        .child(div().py(4).child(diffBlock(`fix-${i}`, file.rows, t)))));
    body = v_flex().id("fix-body").flex_1().min_h(0).overflow_y_scrollbar().px(14).py(12).child(content);
  }
  const canPush = f.phase === "ready" && (f.files?.length ?? 0) > 0;
  const canDiscard = f.phase === "ready" || f.phase === "failed";
  const canReply = canDiscard && Boolean(v.fixSession?.id);
  // The reply box is only drawn while replying, so fix keys can never land in it.
  const reply = div().px(14).pb(8).child(textInput(t, v.replyInput, true));
  const bar = h_flex().px(14).py(10).gap(6).flex_wrap().border_t_1().border_color(t.border)
    .child(button(t, "fix-back", "Back to tour", "b", true, (_e, cx) => { v.closeFix(); cx.notify(); }))
    .child(button(t, "fix-reply", "Reply to the agent", "r", canReply, (_e, cx) => { v.startReply(cx); cx.notify(); }))
    .child(button(t, "fix-push", f.confirm ? `Press p again to push to ${pr.head}` : `Push to ${pr.head}`, "p", canPush, (_e, cx) => { v.pushFix(cx); cx.notify(); }))
    .child(button(t, "fix-discard", "Discard fix", "x", canDiscard, (_e, cx) => { v.discardFix(cx); cx.notify(); }));
  return v_flex().flex_1().min_h(0).child(header).child(body).when(v.replying, el => el.child(reply)).child(bar);
}
