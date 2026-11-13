// One mod, two places. In a layout block with props { "slot": true } it is the small
// now-playing slot (slot.js). Opened as an overlay it is the dialog (dialog.js).
import { View } from "gpui-kit";
import { props } from "herdr";
import { Dialog } from "./dialog.js";
import { Slot } from "./slot.js";

/** @typedef {import("gpui-kit").Context} Context */

export default class Spotify extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    // Herdr's props come from props(), not init's first argument.
    this.part = props()?.slot ? new Slot() : new Dialog();
    this.part.init(cx);
  }

  /** @param {Context} cx */
  render(cx) {
    return this.part.render(cx);
  }
}
