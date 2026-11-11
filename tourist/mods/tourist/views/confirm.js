// The confirm dialog: before a fix is pushed, a review posted or a PR merged, a card in the
// middle of the pane says what will happen. y goes ahead, n or esc cancels. The pane behind it is
// dimmed and takes no clicks while it's open.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { button } from "../ui.js";
import { eventsFor } from "../review.js";

/** `{ title, text, yes, go, cancel }` for the action waiting on a yes, or null when none is. */
export function pendingConfirm(v) {
  const pr = v.pr;
  if (!pr) return null;
  if (v.phase === "fix" && v.fix?.confirm && v.fix.phase === "ready") return {
    title: "Push the fix?", yes: "Push",
    text: `Commits the fix as "Address review comments on #${pr.number}" and pushes it to ${pr.head} on GitHub.`,
    go: cx => v.pushFix(cx), cancel: () => { v.fix.confirm = false; },
  };
  if (v.phase === "review" && v.review?.confirm && v.review.phase === "editing") {
    const event = eventsFor(pr)[v.review.cursor] ?? eventsFor(pr)[0], n = v.comments.length;
    return {
      title: `Post "${event.label}"?`, yes: "Post",
      text: `Posts to PR #${pr.number} as ${pr.me || "the gh account"}${n ? `, with ${n} comment${n === 1 ? "" : "s"}` : ""}. Everyone on the PR will see it.`,
      go: cx => v.postReview(cx), cancel: () => { v.review.confirm = false; },
    };
  }
  const m = v.merge, method = m?.methods?.[m.cursor];
  if (v.phase === "merge" && m?.confirm && m.phase === "picking" && method) return {
    title: `${method.label}?`, yes: "Merge",
    text: `Merges PR #${pr.number} into ${pr.base}, only if its head is still ${pr.headOid.slice(0, 7)}.`,
    go: cx => v.doMerge(cx), cancel: () => { m.confirm = false; },
  };
  return null;
}

/** The dialog over the whole pane, or null. */
export function confirmDialog(v, t) {
  const c = pendingConfirm(v);
  if (!c) return null;
  // Clicks stop at the backdrop, so the screen behind can't be used while the dialog is open.
  // The dialog's buttons sit in front of it and get their clicks first.
  const dim = /^#[0-9a-f]{6}/i.test(t.background) ? `${t.background.slice(0, 7)}b3` : t.background;
  return div().id("confirm-backdrop").absolute().inset_0().flex().items_center().justify_center().p(16)
    .bg(dim).on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .child(v_flex().id("confirm").w(440).max_w_full().p(18).gap(10).rounded(12)
      .border_1().border_color(t.accent).bg(t.raised)
      .child(div().text_size(15).font_semibold().child(c.title))
      .child(div().text_size(12.5).text_color(t.muted).child(c.text))
      .child(h_flex().pt(6).gap(8).justify_end()
        .child(button(t, "confirm-no", "Cancel", "n", true, (_e, cx) => { c.cancel(); cx.notify(); }))
        .child(button(t, "confirm-yes", c.yes, "y", true, (_e, cx) => { c.go(cx); cx.notify(); }))));
}
