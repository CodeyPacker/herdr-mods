// The card that opens when the pointer rests on the slot: larger art, the track, its
// progress, the playback buttons and the volume.
import { div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { slider, iconButton } from "../kit/controls.js";
import { iconPath, clock } from "../ui.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @typedef {import("../player.js").Track} Track */
/** @typedef {import("../now-playing.js").NowPlaying} NowPlaying */
/**
 * Gives a part of the card its hover handler. The slot's card passes one so every button and
 * slider reports when the pointer is on it (see Slot.hoverRegions). The dialog passes none.
 * @typedef {(region: string) => (hovered: boolean, cx: Context) => void} HoverWatch
 */

const CARD_W = 300;
const PAD = 12;
const ART_SIZE = 64;
const BAR_W = CARD_W - PAD * 2;
const VOLUME_LABEL_W = 30;
// The volume row is the icon (14), the slider and the percent label, with two 8 px gaps.
const VOLUME_W = BAR_W - 14 - VOLUME_LABEL_W - 16;

/**
 * The playback buttons. Shared with the dialog's header, which draws them `large`.
 * @param {NowPlaying} now @param {Track} p @param {Theme} t @param {{ watch?: HoverWatch, large?: boolean }} [options]
 */
export function playbackButtons(now, p, t, options = {}) {
  const { watch, large } = options;
  /** @param {string} id @param {string} name @param {(cx: Context) => void} click @param {{ lit?: boolean, big?: boolean, mark?: string }} [look] */
  const button = (id, name, click, look) => iconButton(t, id, iconPath(name), click, { ...look, large }).when(Boolean(watch), (el) => el.on_hover(watch?.(id) ?? (() => {})));
  return h_flex().gap(large ? 22 : 6).items_center().flex_none()
    .child(button("sp-shuffle", "shuffle", (cx) => now.toggleShuffle(cx), { lit: p.shuffle }))
    .child(button("sp-previous", "previous", (cx) => now.previous(cx)))
    .child(button("sp-toggle", p.playing ? "pause" : "play", (cx) => now.toggle(cx), { big: true }))
    .child(button("sp-next", "next", (cx) => now.next(cx)))
    // Repeat has three modes: off, the whole list, and the one track (marked with a 1).
    .child(button("sp-repeat", "repeat", (cx) => now.cycleRepeat(cx), { lit: p.repeat !== "off", mark: p.repeat === "track" ? "1" : undefined }));
}

/**
 * The speaker icon, the volume slider and the percent.
 * @param {NowPlaying} now @param {number} volume @param {number} width the slider's width @param {Theme} t @param {HoverWatch} [watch]
 */
export function volumeRow(now, volume, width, t, watch) {
  return h_flex().gap(8).items_center().flex_none()
    .child(svg(iconPath("volume")).size(14).flex_none().text_color(t.muted))
    .child(slider(t, now.volume.state, width, { color: t.muted, onHover: watch?.("sp-volume") }))
    .child(div().w(VOLUME_LABEL_W).flex_none().text_size(10.5).text_color(t.dim).child(`${volume}%`));
}

/** @param {NowPlaying} now @param {Track} p the shown track @param {Theme} t @param {HoverWatch} watch */
export function cardView(now, p, t, watch) {
  const picture = now.art.large
    ? image(now.art.large).size(ART_SIZE).rounded(6).flex_none()
    : div().size(ART_SIZE).flex_none().rounded(6).bg(t.raised);
  return v_flex().id("sp-card-body").w(CARD_W).p(PAD).gap(10).rounded(8).border_1().border_color(t.border).bg(t.popover).shadow_lg()
    .text_size(12).text_color(t.foreground)
    .on_hover(watch("sp-card"))
    .child(h_flex().gap(10).items_center()
      .child(picture)
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(div().truncate().font_semibold().text_size(13).child(p.title))
        .child(div().truncate().text_color(t.muted).child(p.artist))
        .when(Boolean(p.album), (el) => el.child(div().truncate().text_size(11).text_color(t.dim).child(p.album)))))
    // Drag the progress bar, or click along it, to jump in the track.
    .child(v_flex().gap(2)
      .child(slider(t, now.seek.state, BAR_W, { color: p.playing ? t.accent : t.dim, onHover: watch("sp-seek") }))
      .child(h_flex().justify_between().text_size(10.5).text_color(t.dim)
        .child(clock(p.progressMs)).child(clock(p.durationMs))))
    .child(h_flex().justify_center().child(playbackButtons(now, p, t, { watch })))
    // No volume row for a device that does not let Spotify set its volume.
    .when(p.volume !== null, (el) => el.child(volumeRow(now, p.volume ?? 0, VOLUME_W, t, watch)))
    .when(Boolean(p.device), (el) => el.child(div().truncate().text_size(10.5).text_color(t.dim).child(`Playing on ${p.device}`)))
    .when(Boolean(now.message), (el) => el.child(div().text_size(11).text_color(t.ansi1).child(now.message ?? "")));
}
