// Setup's layout page: which side the panel sits on, how wide it is, and whether it hides its
// help sentences. Changes save at once, and the Neovim split in this tab follows them.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { chip, slider, keyButton } from "../kit/controls.js";
import { banner } from "../kit/pane.js";
import { pageTop, pageBody, pageLegend } from "./parts.js";
import { layoutSketch } from "./hub.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("../types.js").Layout} Layout */

/** One setting: its name, then its controls. @param {Theme} t @param {string} name @param {any} controls */
function setting(t, name, controls) {
  return v_flex().gap(6).child(div().text_size(12).font_semibold().text_color(t.muted).child(name)).child(controls);
}

/**
 * @param {Theme} t
 * @param {{ layout: Layout, width: any, editor: "neovim" | "vscode" | null, dialog: boolean, error: string,
 *   change: (layout: Partial<Layout>, cx: Context) => void, reset: (cx: Context) => void }} options
 *   `width`: the SliderState for the panel's width, in percent. `error`: why it couldn't be read or saved
 */
export function layoutPage(t, { layout, width, editor, dialog, error, change, reset }) {
  const percent = Math.round(layout.width * 100);
  // Side and width only shape the Neovim split. VS Code opens in its own window.
  const note = editor === "vscode" ? "Side and width shape the Neovim split. VS Code opens in its own window, so only compact applies."
    : dialog ? "The dialog uses the new side and width the next time it opens."
    : "This tab's Neovim split follows as you change them.";
  return v_flex().flex_1().min_h(0)
    .child(pageBody("setup-layout")
      .child(pageTop(t, { label: "SETUP · LAYOUT · OPTIONAL", title: "Arrange your screen", intro: "Changes save as you make them.", compact: layout.compact }))
      .when(Boolean(error), element => element.child(banner(t, error, t.blocked)))
      // Not a card: the slider's line is drawn in the card color, so it would vanish on one.
      .child(v_flex().gap(16)
        .child(h_flex().gap(16).items_center().flex_wrap()
          .child(layoutSketch(t, layout))
          .child(div().text_size(12).text_color(t.muted).flex_1().min_w(160).child(note)))
        .child(setting(t, "Panel side", h_flex().gap(6)
          .child(chip(t, { id: "layout-left", label: "Left", on: layout.side === "left", click: cx => change({ side: "left" }, cx) }))
          .child(chip(t, { id: "layout-right", label: "Right", on: layout.side === "right", click: cx => change({ side: "right" }, cx) }))))
        .child(setting(t, `Panel width · ${percent}%`, h_flex().gap(10).items_center()
          .child(div().text_size(11).text_color(t.dim).child("30%"))
          .child(slider(t, width, 220))
          .child(div().text_size(11).text_color(t.dim).child("70%"))))
        .child(setting(t, "Compact", h_flex().gap(6).items_center()
          .child(chip(t, { id: "layout-full", label: "Show help", on: !layout.compact, click: cx => change({ compact: false }, cx) }))
          .child(chip(t, { id: "layout-compact", label: "Hide help", on: layout.compact, click: cx => change({ compact: true }, cx) }))
          .child(div().text_size(11).text_color(t.dim).child("Hide the sentences that explain each part."))))
        .child(h_flex().child(keyButton(t, "layout-reset", "0", "Reset to default", true, reset)))))
    .child(pageLegend(t, [["h/l", "width"], ["s", "swap side"], ["c", "compact"], ["0", "reset"], ["esc", "back"]]));
}
