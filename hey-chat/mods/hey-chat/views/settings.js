// The Settings card: a solid popover above the sidebar's bottom row, for your picture
// (upload or drop a photo), your initials and their color.
import { div, svg } from "gpui-kit";
import { h_flex, v_flex, Input } from "gpui-base";
import { myPicture } from "../pictures.js";
import { COLORS } from "../me.js";
import { roundButton } from "./tree.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */

const ICONS = "mods/hey-chat/icons";
const CLEAR = "#00000000";

/** The dim label over a group. @param {Theme} t @param {string} text */
function label(t, text) {
  return div().text_size(12).text_color(t.muted).child(text);
}

/** A round choice that shows it is picked with a ring. @param {Theme} t @param {string} id @param {boolean} on @param {any} inner @param {(cx: any) => void} click */
function choice(t, id, on, inner, click) {
  return h_flex().id(id).flex_none().p(2).rounded_full().border_2().border_color(on ? t.foreground : CLEAR).cursor_pointer()
    .hover((s) => s.border_color(on ? t.foreground : t.muted))
    .on_click((_e, cx) => { click(cx); cx.notify(); })
    .child(inner);
}

/** The card. @param {any} v the view @param {Theme} t */
export function settingsView(v, t) {
  const me = v.me;
  const busy = Boolean(v.photoBusy);
  return v_flex().id("settings").absolute().left(10).right(10).bottom(64).p(18).gap(16)
    .rounded(16).bg(t.popover).border_1().border_color(t.border).shadow_lg()
    // A press inside the card stays in it, and dropping a picture on it uses that picture.
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_drop((e, cx) => { v.usePhoto(e.paths[0], cx); cx.notify(); })
    .child(h_flex().items_center().justify_between()
      .child(div().text_size(15).font_semibold().text_color(t.foreground).child("Settings"))
      .child(roundButton(t, "settings-close", `${ICONS}/close.svg`, 30, (cx) => { v.closeSettings(); cx.notify(); })))
    .child(div().text_size(11).font_semibold().text_color(t.muted).child("YOUR PICTURE"))
    .child(h_flex().gap(16).items_center()
      .child(myPicture(me, 72))
      .child(v_flex().gap(8).items_start()
        .child(h_flex().id("upload").h(34).px(14).gap(6).items_center().rounded_full().bg(t.raised).cursor_pointer()
          .text_size(13).font_medium().text_color(t.foreground).hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { v.uploadPhoto(cx); cx.notify(); })
          .child(svg(`${ICONS}/upload.svg`).size(15))
          .child(busy ? "Adding…" : "Upload photo"))
        .when(Boolean(me.picture), (el) => el.child(div().id("remove-photo").px(4).py(2).rounded(6).cursor_pointer()
          .text_size(13).text_color(t.muted).hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => { v.setPicture(null); cx.notify(); })
          .child("Use initials")))))
    .when(Boolean(v.photoError), (el) => el.child(div().text_size(12).text_color(t.blocked).child(v.photoError ?? "")))
    .child(v_flex().gap(6)
      .child(label(t, "Initials"))
      .child(h_flex().h(36).px(12).items_center().rounded(10).bg(t.background).border_1().border_color(t.border)
        .child(Input.new(v.initialsInput).flex_1().text_size(14).text_color(t.foreground))))
    .child(v_flex().gap(8)
      .child(label(t, "Initials color"))
      .child(h_flex().gap(4).children(COLORS.map((c) =>
        choice(t, `color-${c}`, me.color === c, div().size(26).rounded_full().bg(c), () => v.setColor(c))))))
    .child(div().text_size(12).text_color(t.dim).child("Drop a picture here to use it. Shows next to your messages."))
    .child(div().h(1).bg(t.border))
    .child(h_flex().id("condense-chat").gap(10).items_center().justify_between().cursor_pointer()
      .on_click((_e, cx) => { v.toggleCondenseChat(); cx.notify(); })
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(div().text_size(13).text_color(t.foreground).child("Condense chat"))
        .child(div().text_size(11.5).text_color(t.dim).child("Hide tool cards, including file edits. Show activity beside the dots.")))
      .child(toggle(t, v.condenseChat)))
    // Key hints: the sidebar's legend, the message box's scroll hint and the keys on buttons.
    .child(h_flex().id("key-hints").gap(10).items_center().justify_between().cursor_pointer()
      .on_click((_e, cx) => { v.toggleKeyHints(); cx.notify(); })
      .child(v_flex().gap(2)
        .child(div().text_size(13).text_color(t.foreground).child("Show key hints"))
        .child(div().text_size(11.5).text_color(t.dim).child("The keys on buttons and in the sidebar.")))
      .child(toggle(t, v.keyHints)));
}

/** An on/off switch: a track that fills with the accent when on, and a round knob. @param {Theme} t @param {boolean} on */
function toggle(t, on) {
  return h_flex().flex_none().w(36).h(20).p(2).rounded_full().bg(on ? t.accent : t.hover)
    .when(on, (el) => el.justify_end())
    .child(div().size(16).rounded_full().bg(on ? t.accent_foreground : t.muted));
}
