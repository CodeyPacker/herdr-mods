// The build screen: what the agent is writing now, how long it has taken, and any error.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { paneHeader, paneTitle, paneDetail, paneBar, banner } from "../kit/pane.js";
import { spinner } from "../kit/controls.js";
import { button } from "../ui.js";

const clock = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/** `v` is the Tutor view: its state is read here and its methods run on clicks. */
export function buildView(v, t) {
  const job = v.job, failed = Boolean(job.error);
  const header = paneHeader(t).child(paneTitle(t, job.title)).child(paneDetail(t, job.detail ?? "")).child(v.shortcuts.button(t));
  // Sized to its content, so it also draws in a dialog. The spacer below pushes the keys down in a pane.
  const body = v_flex().w_full().px(24).py(20).gap(12).max_w(720)
    .when(!failed, el => el
      .child(h_flex().gap(10).items_center().text_size(13.5)
        .child(spinner(t)).child(div().flex_1().min_w(0).child(job.status))
        .child(div().flex_none().text_size(12).text_color(t.dim).child(clock(Date.now() - job.started))))
      .child(div().text_size(12).text_color(t.dim).child(job.spec.wait ?? ""))
      .child(div().text_size(12).text_color(t.dim).child("You can keep working in other panes. esc stops this.")))
    .when(failed, el => el
      .child(banner(t, job.error, t.ansi1))
      .child(div().text_size(12).text_color(t.dim).child("enter tries again. esc goes back.")))
    .when(v.agentOk === false, el => el.child(div().text_size(12).text_color(t.ansi1)
      .child(`The ${v.agentName()} CLI (${v.settings.agent}) is not on PATH, so Tutor cannot write lessons. Install it and sign in, or pick the other agent on the setup screen${v.shown("setup-choices", " (a)")}.`)));
  const bar = paneBar(t)
    .when(failed, el => el.child(button(t, "build-retry", "Try again", "enter", true, cx => { v.retryJob(cx); cx.notify(); })))
    .child(button(t, "build-back", failed ? "Back" : "Stop", "esc", true, cx => { v.leaveJob(cx); cx.notify(); }));
  return v_flex().size_full().min_h(0).child(header).child(body).child(div().flex_1()).child(bar);
}
