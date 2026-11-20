// Tutor's small building blocks, made from the shared kit (kit/).
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { settings } from "herdr";
import { keyButton } from "./kit/controls.js";

/**
 * A key-bar button. Dim and inert when not enabled. `click` gets the click's cx.
 * With no `key` (its shortcut is turned off in the settings) it is the same button without one.
 */
export function button(t, id, label, key, enabled, click) {
  if (key) return keyButton(t, id, key, label, enabled, click);
  return h_flex().id(id).flex_none().h(28).px(10).items_center().rounded(8).border_1()
    .border_color(t.border).bg(t.raised).text_size(12).text_color(enabled ? t.foreground : t.dim)
    .when(enabled, el => el.cursor_pointer().hover(s => s.border_color(t.accent)).on_click((_e, cx) => click(cx)))
    .child(label);
}

/** A short block of code in the mono font. `wrap` breaks long lines instead of cutting them off. */
export function codeBlock(t, text, wrap = false) {
  return v_flex().p(10).rounded(8).border_1().border_color(t.border).bg(t.background)
    .font_family(String(settings().font_family ?? "")).text_size(12)
    .children(String(text).split("\n").map(line => (wrap ? div().w_full().min_w(0) : div().whitespace_nowrap()).child(line || " ")));
}

/** The dim label over a note, then the note. */
export function noteLabel(t, text) {
  return div().text_size(11.5).font_semibold().text_color(t.accent).child(text);
}
