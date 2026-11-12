// tickets: one mod, two places. Opened as an overlay it is the board (board.js). In a layout
// block with props { "slot": true } it is the small count of tickets waiting on you (slot.js).
// Tickets are made and changed with ticket.mjs in this folder (see its top comment).
import { View } from "gpui-kit";
import { props } from "herdr";
import { Board } from "./board.js";
import { Slot } from "./slot.js";

/** @typedef {import("gpui-kit").Context} Context */

export default class Tickets extends View {
  /** @param {unknown} _props @param {Context} cx */
  init(_props, cx) {
    // Herdr's props come from props(), not init's first argument.
    this.part = props()?.slot ? new Slot() : new Board();
    this.part.init(cx);
  }

  /** @param {Context} cx */
  render(cx) {
    return this.part.render(cx);
  }
}
