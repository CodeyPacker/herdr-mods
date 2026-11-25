// The Settings dialog, centered over the pane. General: your picture (upload or drop a photo),
// your initials and their color, how the chat shows, and agent setup. Shortcuts: each key, which
// can be changed or turned off, and whether key hints show.
import { div, svg } from "gpui-kit";
import { h_flex, v_flex, Input } from "gpui-base";
import { myPicture } from "../pictures.js";
import { COLORS } from "../me.js";
import { keyLabel } from "../shortcuts.js";
import { roundButton } from "./tree.js";
import { ICONS } from "../common.js";
import { tabStrip } from "../kit/tabs.js";
import { divider } from "../kit/frame.js";
import { listRow } from "../kit/list.js";
import { legend } from "../kit/legend.js";
import { sectionLabel } from "../kit/pane.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */

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

/** An on/off switch: a track that fills with the accent when on, and a round knob. @param {Theme} t @param {boolean} on */
function toggle(t, on) {
  return h_flex().flex_none().w(36).h(20).p(2).rounded_full().bg(on ? t.accent : t.hover)
    .when(on, (el) => el.justify_end())
    .child(div().size(16).rounded_full().bg(on ? t.accent_foreground : t.muted));
}

/** A setting with a switch: its name, what it does, and the switch. @param {Theme} t @param {string} id @param {string} name @param {string} detail @param {boolean} on @param {(cx: any) => void} click */
function switchRow(t, id, name, detail, on, click) {
  return h_flex().id(id).gap(10).items_center().justify_between().cursor_pointer()
    .on_click((_e, cx) => { click(cx); cx.notify(); })
    .child(v_flex().flex_1().min_w(0).gap(2)
      .child(div().text_size(13).text_color(t.foreground).child(name))
      .child(div().text_size(11.5).text_color(t.dim).child(detail)))
    .child(toggle(t, on));
}

/** The General tab. @param {any} v @param {Theme} t */
function generalTab(v, t) {
  const me = v.me;
  return v_flex().id("settings-general").flex_1().min_h(0).overflow_y_scrollbar().gap(16).pr(4)
    .child(div().text_size(11).font_semibold().text_color(t.muted).child("YOUR PICTURE"))
    .child(h_flex().gap(16).items_center()
      .child(myPicture(me, 72))
      .child(v_flex().gap(8).items_start()
        .child(h_flex().id("upload").h(34).px(14).gap(6).items_center().rounded_full().bg(t.raised).cursor_pointer()
          .text_size(13).font_medium().text_color(t.foreground).hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { v.uploadPhoto(cx); cx.notify(); })
          .child(svg(`${ICONS}/upload.svg`).size(15))
          .child(v.photoBusy ? "Adding…" : "Upload photo"))
        .when(Boolean(me.picture), (el) => el.child(div().id("remove-photo").px(4).py(2).rounded(6).cursor_pointer()
          .text_size(13).text_color(t.muted).hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => { v.setPicture(null); cx.notify(); })
          .child("Use initials")))))
    .when(Boolean(v.photoError), (el) => el.child(div().text_size(12).text_color(t.blocked).child(v.photoError ?? "")))
    .child(v_flex().gap(6)
      .child(label(t, "Initials"))
      .child(h_flex().w(200).h(36).px(12).items_center().rounded(10).bg(t.background).border_1().border_color(t.border)
        .child(Input.new(v.initialsInput).flex_1().text_size(14).text_color(t.foreground))))
    .child(v_flex().gap(8)
      .child(label(t, "Initials color"))
      .child(h_flex().gap(4).children(COLORS.map((c) =>
        choice(t, `color-${c}`, me.color === c, div().size(26).rounded_full().bg(c), () => v.setColor(c))))))
    .child(div().text_size(12).text_color(t.dim).child("Drop a picture here to use it. Shows next to your messages."))
    .child(divider(t))
    .child(switchRow(t, "condense-chat", "Condense chat", "Hide tool cards, including file edits. Show activity beside the dots.",
      v.condenseChat, () => v.toggleCondenseChat()))
    .child(switchRow(t, "show-plan", "Show plan", "Show the agent's checklist above the message box while it works.",
      v.showPlan, () => v.toggleShowPlan()))
    .child(div().id("open-setup").py(6).text_size(13).text_color(t.foreground).cursor_pointer()
      .hover(s => s.text_color(t.accent))
      .on_click((_e, cx) => { v.closeSettings(); v.setupOpen = true; v.refreshSetup(cx); cx.notify(); }).child("Agent setup"));
}

/**
 * The Shortcuts tab: the key hints switch, then each shortcut with its key and whether it is on.
 * A click on a row turns it on or off. A click on a key waits for a new one. The keys work as
 * well: j and k move, space turns on or off, enter changes the key.
 * @param {any} v @param {Theme} t
 */
function shortcutsTab(v, t) {
  const s = v.shortcuts;
  const options = s.options.length;
  if (s.reveal) {
    // The headings are items of the list too: one over the options, one over the keys.
    s.scroll.scroll_to_item(s.at < options ? s.at + 1 : s.at + 2);
    s.reveal = false;
  }
  /** @param {number} i @param {any} key @param {string} what @param {boolean} on */
  const row = (i, key, what, on) => listRow(t, { id: `shortcut-${i}`, on: i === s.at, compact: true, click: (cx) => { s.flip(i); cx.notify(); } })
    .child(key)
    .child(div().flex_1().min_w(0).truncate().text_color(on ? t.foreground : t.dim).child(what))
    .child(div().flex_none().text_size(11.5).text_color(on ? t.accent : t.dim).child(on ? "On" : "Off"));
  const keyCap = (/** @type {number} */ i, /** @type {any} */ k) => {
    const waiting = s.capturing === k.id;
    const text = waiting ? "press a key" : keyLabel(s.keyFor(k.id)) || "none";
    return div().w(96).flex_none().child(div().id(`shortcut-key-${i}`).flex_none().px(8).py(2).rounded(6).truncate()
      .text_size(12).font_semibold().border_1().border_color(waiting ? t.accent : t.border).bg(t.raised)
      .text_color(s.isOff(k.id) ? t.dim : t.accent)
      // A press on a key waits for its new key, and doesn't also switch the row.
      .when(!k.fixed, (el) => el.cursor_pointer().hover((st) => st.bg(t.hover))
        .on_click((_e, cx) => { s.change(i); cx.stop_propagation(); cx.notify(); }))
      .child(text));
  };
  return v_flex().flex_1().min_h(0).gap(10)
    .child(v_flex().id("shortcut-list").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(s.scroll).gap(2)
      .child(sectionLabel(t, "Options"))
      .children(s.options.map((/** @type {any} */ o, /** @type {number} */ i) => row(i, div().w(96).flex_none(), o.label, s.option(o.id))))
      .child(sectionLabel(t, "Shortcut keys"))
      .children(s.keys.map((/** @type {any} */ k, /** @type {number} */ i) => row(options + i, keyCap(options + i, k), k.what, !s.isOff(k.id)))))
    .child(divider(t))
    .child(legend(t, s.capturing !== null
      ? [["esc", "keep the old key"], ["⌫", "the key it came with"]]
      : [["j k", "move"], ["space", "on or off"], ["↵", "change key"], ["esc", "close"]]));
}

/** The dialog, over a dimmed pane. A press beside it closes it. @param {any} v the view @param {Theme} t */
export function settingsDialog(v, t) {
  const w = Math.max(320, Math.min(620, v.width - 40));
  const h = Math.max(320, Math.min(600, v.height - 40));
  const tab = v.settingsTab;
  const card = v_flex().id("settings").w(w).h(h).p(20).gap(14).rounded(16).bg(t.popover).border_1().border_color(t.border).shadow_lg()
    // A press inside the dialog stays in it, and dropping a picture on it uses that picture.
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_drop((e, cx) => { v.usePhoto(e.paths[0], cx); cx.notify(); })
    .child(h_flex().flex_none().items_center().justify_between()
      .child(div().text_size(16).font_semibold().text_color(t.foreground).child("Settings"))
      .child(roundButton(t, "settings-close", `${ICONS}/close.svg`, 30, (cx) => { v.closeSettings(); cx.notify(); })))
    .child(tabStrip(t, [
      { id: "settings-general", label: "General", on: tab === "general", click: (cx) => { v.setSettingsTab("general"); cx.notify(); } },
      { id: "settings-shortcuts", label: "Shortcuts", on: tab === "shortcuts", click: (cx) => { v.setSettingsTab("shortcuts"); cx.notify(); } },
    ]))
    .child(divider(t))
    .child(tab === "shortcuts" ? shortcutsTab(v, t) : generalTab(v, t));
  return h_flex().id("settings-around").absolute().top(0).left(0).size_full().items_center().justify_center().bg("#00000066")
    .on_mouse_down("left", (_e, cx) => { v.closeSettings(); cx.notify(); })
    .child(card);
}
