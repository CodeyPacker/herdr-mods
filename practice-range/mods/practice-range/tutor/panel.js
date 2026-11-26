import { div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { keyButton, textInput, spinner } from "../kit/controls.js";
import { banner } from "../kit/pane.js";

/** @typedef {{ role: "user" | "assistant", content: string }} TutorMessage */

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
