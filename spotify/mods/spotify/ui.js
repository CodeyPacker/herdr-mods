// Small building blocks the views share.
import { div, svg } from "gpui-kit";
import { h_flex, Input, Slider, SliderTrack, SliderIndicator, SliderThumb } from "gpui-base";
import { theme } from "herdr";
import { MOD, SPINNER } from "./constants.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {Record<string, any>} Theme */

/** The theme's colors by name. @returns {Theme} */
export function colors() {
  return theme();
}

/** One of the mod's icons, for svg(). @param {string} name */
export function iconPath(name) {
  return `mods/${MOD}/icons/${name}.svg`;
}

/** Milliseconds as m:ss. @param {number} ms */
export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** @param {Theme} t */
export function spinner(t) {
  return div().text_color(t.accent).frames(SPINNER, 90).child(SPINNER[0]);
}

/** A one-line text box. `active` outlines it in the accent color. @param {Theme} t @param {any} state @param {boolean} [active] */
export function textInput(t, state, active = true) {
  return Input.new(state).h(32).px(10).rounded(8).border_1().border_color(active ? t.accent : t.input).bg(t.background).text_size(12.5).text_color(t.foreground);
}

/**
 * A round button with one icon. `lit` draws it in the accent color, for a mode that is on.
 * @param {Theme} t @param {string} id @param {string} name the icon @param {(cx: Context) => void} click
 * @param {{ lit?: boolean, big?: boolean, large?: boolean, mark?: string }} [look]
 *   `big`: the main button, filled. `large`: the dialog's roomier size. `mark`: a small label beside the icon.
 */
export function iconButton(t, id, name, click, look = {}) {
  const size = look.large ? (look.big ? 48 : 36) : (look.big ? 34 : 28);
  const icon = look.large ? (look.big ? 20 : 18) : (look.big ? 16 : 14);
  return h_flex().id(id).h(size).min_w(size).px(4).gap(2).flex_none().items_center().justify_center().rounded(size / 2)
    .cursor_pointer().hover((s) => s.bg(t.hover))
    .when(Boolean(look.big), (el) => el.bg(t.raised))
    .on_click((_e, cx) => click(cx))
    .child(svg(iconPath(name)).size(icon).text_color(look.lit ? t.accent : look.big ? t.foreground : t.muted))
    .when(Boolean(look.mark), (el) => el.child(div().text_size(9).font_semibold().text_color(t.accent).child(look.mark ?? "")));
}

/**
 * A line with a round knob: drag the knob, or click along the line. Herdr places the fill
 * and the knob from `state`, a SliderState.
 * @param {Theme} t @param {any} state @param {number} width
 * @param {{ color?: any, thick?: boolean, onHover?: (hovered: boolean, cx: Context) => void }} [look]
 *   `color`: the fill (default: the accent). `thick`: the dialog's heavier line with a bright knob.
 *   `onHover`: told when the pointer comes onto or leaves the slider.
 */
export function slider(t, state, width, look = {}) {
  const color = look.color ?? t.accent;
  const line = look.thick ? 5 : 3;
  const knob = look.thick ? 14 : 10;
  const onHover = look.onHover;
  return Slider.new(state).child(
    SliderTrack.new(state).flex().items_center().h(knob + 4).w(width).cursor_pointer()
      .when(Boolean(onHover), (el) => el.on_hover((hovered, cx) => onHover?.(hovered, cx))).child(
      SliderIndicator.new(state).relative().w_full().h(line).rounded(line / 2).bg(t.raised)
        .range_style((fill) => fill.rounded(line / 2).bg(color))
        // The knob starts at the line's top left: pull it up and left by half its extra size to center it.
        .child(SliderThumb.new(state).size(knob).rounded(knob / 2).bg(look.thick ? t.foreground : color)
          .ml(-knob / 2).mt(-(knob - line) / 2))));
}

/**
 * A hint icon's size. At 11 px the icon's drawing is about as tall as a lowercase letter of the
 * 11 px hint text, so centered on the line it sits on the same baseline as the letters beside it.
 */
const HINT_ICON = 11;

/**
 * One key hint: the key, then what it does as a word or as one of the mod's icons.
 * @typedef {[string, string | { icon: string }]} Hint
 */

/** A line of key hints: each key in the accent color, its meaning dim. @param {Theme} t @param {Hint[]} hints */
export function hintLine(t, hints) {
  return h_flex().flex_none().flex_wrap().gap(12).text_size(11).children(hints.map(([key, what]) =>
    h_flex().gap(4).items_center()
      .child(div().text_color(t.accent).font_semibold().child(key))
      .child(typeof what === "string"
        ? div().text_color(t.dim).child(what)
        : svg(iconPath(what.icon)).size(HINT_ICON).flex_none().text_color(t.dim))));
}
