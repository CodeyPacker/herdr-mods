import { div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { keyButton, textInput, spinner } from "../kit/controls.js";
import { banner } from "../kit/pane.js";

/** @typedef {{ role: "user" | "assistant", content: string }} TutorMessage */

/**
 * @param {import("../kit/theme.js").Theme} t
 * @param {{ config: import("./config.js").TutorConfig, busy: boolean, error: string,
 *   change: (provider: import("./config.js").TutorProvider | null, cx: import("gpui-kit").Context) => void }} options
 */
export function tutorSettings(t, { config, busy, error, change }) {
  return v_flex().id("tutor-settings").p(12).gap(9).rounded(8).bg(t.raised)
    .child(div().font_semibold().child("AI tutor · Optional"))
    .child(div().text_size(12).text_color(t.muted).child("Practice works without AI. Connect a signed-in Codex or Claude Code command to ask questions about an exercise."))
    .child(div().text_size(12).text_color(t.muted).child("Only when you ask, your saved answer, exercise, check results, and recent chat are sent to that provider. The tutor explains code; it does not edit or run it."))
    .child(h_flex().gap(6).flex_wrap()
      .child(keyButton(t, "tutor-off", "", config.enabled ? "Turn AI off" : "No AI · Selected", !busy, cx => change(null, cx)))
      .child(keyButton(t, "tutor-codex", "", config.provider === "codex" ? "Codex · Connected" : "Connect Codex", !busy, cx => change("codex", cx)))
      .child(keyButton(t, "tutor-claude", "", config.provider === "claude" ? "Claude · Connected" : "Connect Claude", !busy, cx => change("claude", cx))))
    .when(busy, element => element.child(div().text_color(t.muted).child("Checking connection…")))
    .when(Boolean(error), element => element.child(banner(t, error, t.blocked)))
    .child(div().text_size(11).text_color(t.dim).child("Install and sign in to the CLI first: codex login or claude auth login. Provider usage counts toward your account limits."));
}

/**
 * @param {import("../kit/theme.js").Theme} t
 * @param {{ messages: TutorMessage[], busy: boolean, error: string,
 *   input: import("gpui-base").InputState, typing: boolean,
 *   send: (cx: import("gpui-kit").Context) => void }} options
 */
export function tutorChat(t, { messages, busy, error, input, typing, send }) {
  return v_flex().id("tutor-chat").p(12).gap(10).rounded(8).bg(t.raised)
    .children(messages.map((message, index) => v_flex().gap(5)
      .child(div().text_size(11).text_color(message.role === "user" ? t.accent : t.muted).child(message.role === "user" ? "You" : "Tutor"))
      .child(TextView.markdown(`tutor-message-${index}`, message.content).selectable())))
    .when(busy, element => element.child(h_flex().gap(8).child(spinner(t)).child(div().child("Thinking…"))))
    .when(Boolean(error), element => element.child(banner(t, error, t.blocked)))
    .child(textInput(t, input, typing))
    .child(h_flex().child(keyButton(t, "tutor-send", "", "Ask", !busy && Boolean(input.value().trim()), send).gap(0)));
}
