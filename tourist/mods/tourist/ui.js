// Small building blocks the views share.
import { div } from "gpui-kit";
import { v_flex, h_flex, Input } from "gpui-base";
import { SPINNER } from "./constants.js";

/** A square key letter, filled when selected. */
export function badge(t, letter, on) {
  return div().w(20).h(20).flex_none().flex().items_center().justify_center().rounded(5).text_size(11).font_semibold()
    .bg(on ? t.accent : t.raised).text_color(on ? t.accent_foreground : t.muted).child(letter);
}

/** A pickable row: key letter, label and a dim hint under it. */
export function option(t, id, letter, label, hint, on, click) {
  return h_flex().id(id).gap(10).px(10).py(7).rounded(7).items_center().cursor_pointer()
    .when(on, el => el.bg(t.selected)).hover(s => s.bg(t.hover))
    .on_click(click)
    .child(badge(t, letter, on))
    .child(v_flex().flex_1().min_w(0).gap(1).child(div().font_medium().child(label)).child(div().text_size(11.5).text_color(t.dim).child(hint)));
}

/** A small button with its key shown first. Dim and inert when not enabled. */
export function button(t, id, label, keyHint, enabled, click) {
  return h_flex().id(id).h(28).px(10).gap(6).items_center().rounded(7)
    .border_1().border_color(t.border).bg(t.raised).text_size(12)
    .text_color(enabled ? t.foreground : t.dim)
    .when(enabled, el => el.cursor_pointer().hover(st => st.bg(t.hover)).on_click(click))
    .child(div().text_color(t.accent).child(keyHint)).child(label);
}

export function spinner(t) {
  return div().text_color(t.accent).frames(SPINNER, 90).child(SPINNER[0]);
}

/** A one-line text box, outlined in the accent color while it has the keyboard. */
export function textInput(t, state, active) {
  return Input.new(state).h(32).px(10).rounded(8).border_1()
    .border_color(active ? t.accent : t.input).bg(t.background).text_size(12.5);
}
