// The sign-in screens: the setup steps with the client ID box, the wait while the browser
// is open, and the box to paste the browser's address into when the redirect was not caught.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { SETUP_STEPS, REDIRECT_PORT } from "../constants.js";
import { spinner, textInput, hintLine } from "../ui.js";

/** @typedef {import("../ui.js").Theme} Theme */

/** @param {Theme} t @param {string | null} text */
const errorLine = (t, text) => div().text_size(12).text_color(t.ansi1).child(text ?? "");

/** An address that opens in the browser when clicked. @param {SignIn} v @param {Theme} t @param {string} url */
function link(v, t, url) {
  return div().id("sp-dashboard-link").cursor_pointer().text_color(t.accent).underline()
    .hover((s) => s.text_color(t.foreground))
    .on_click(() => v.openDashboard())
    .child(url);
}

/** A value in a small box that a click copies, with a note that turns to "Copied". @param {SignIn} v @param {Theme} t @param {string} value */
function copyable(v, t, value) {
  return h_flex().gap(8).items_center()
    .child(div().id("sp-copy-redirect").px(6).py(1).rounded(4).cursor_pointer().bg(t.raised).border_1().border_color(t.border)
      .text_color(t.foreground).hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => v.copyRedirect(cx))
      .child(value))
    .child(div().text_size(11).text_color(v.copied ? t.ansi2 : t.dim).child(v.copied ? "Copied" : "click to copy"));
}

/** @typedef {import("../signin.js").SignIn} SignIn */

/** `v` is the SignIn part: its state is read here. @param {SignIn} v @param {Theme} t */
export function setupView(v, t) {
  return v_flex().id("sp-setup").gap(12)
    .child(div().text_size(12.5).text_color(t.muted).child("Spotify needs a free developer app of your own, and a Premium account. This is a one-time setup."))
    .child(v_flex().gap(6).children(SETUP_STEPS.map((step, i) =>
      h_flex().gap(8).items_start().text_size(12.5)
        .child(div().w(16).flex_none().text_color(t.accent).font_semibold().child(String(i + 1)))
        .child(h_flex().flex_1().min_w(0).flex_wrap().gap(6).items_center().text_color(t.foreground)
          .child(step.text)
          .when(Boolean(step.link), (el) => el.child(link(v, t, step.link ?? "")))
          .when(Boolean(step.copy), (el) => el.child(copyable(v, t, step.copy ?? "")))))))
    .child(textInput(t, v.idInput))
    .when(Boolean(v.error), (el) => el.child(errorLine(t, v.error)))
    .child(hintLine(t, [["enter", "sign in"], ["ctrl-o", "open the dashboard"], ["ctrl-r", "copy the redirect URI"], ["esc", "close"]]));
}

/** @param {any} _v @param {Theme} t */
export function waitingView(_v, t) {
  return v_flex().id("sp-waiting").gap(12)
    .child(h_flex().gap(10).items_center().text_size(12.5).text_color(t.muted)
      .child(spinner(t).text_size(16)).child("Approve the login in your browser…"))
    .child(hintLine(t, [["esc", "cancel"]]));
}

/** @param {any} v @param {Theme} t */
export function pasteView(v, t) {
  const why = v.pasteReason === "busy"
    ? `Another program is using port ${REDIRECT_PORT}, so Herdr could not catch the login.`
    : "Herdr did not catch the login.";
  return v_flex().id("sp-paste").gap(12)
    .child(div().text_size(12.5).text_color(t.muted)
      .child(`${why} After you approve in the browser, copy the whole address from the browser's address bar (it starts with http://127.0.0.1) and paste it here.`))
    .child(textInput(t, v.pasteInput))
    .when(Boolean(v.error), (el) => el.child(errorLine(t, v.error)))
    .child(hintLine(t, [["enter", "finish"], ["esc", "back"]]));
}
