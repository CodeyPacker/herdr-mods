// The now-playing slot: small album art and the track title in a layout block, and a card
// with playback controls on hover. now-playing.js keeps the track current. This file only
// decides when the card is open.
import { run, props } from "herdr";
import { MOD, CARD_OPEN_DELAY, CARD_CLOSE_DELAY, CARD_AFTER_DRAG_DELAY } from "./constants.js";
import { NowPlaying } from "./now-playing.js";
import { authChangeStamp, dialogOpenStamp } from "./signals.js";
import { colors } from "./ui.js";
import { slotView } from "./views/slot.js";

/** @typedef {import("gpui-kit").Context} Context */

export class Slot {
  /** @param {Context} cx */
  init(cx) {
    this.now = new NowPlaying();
    this.now.onSliderReleased = (cx) => this.sliderReleased(cx);
    /**
     * The parts of the slot and card the pointer is on now. Herdr reports the pointer as gone
     * from the card when it moves onto a button or slider inside it, so each of those reports
     * for itself, and the card counts as hovered while any one of them is.
     * @type {Set<string>}
     */
    this.hoverRegions = new Set();
    /** @type {boolean} true while the pointer is on the slot or any part of its card */
    this.hovered = false;
    /** @type {boolean} true while the card shows */
    this.cardOpen = false;
    /** @type {boolean} the card opens above the slot, not below. Set with "card": "above" in the block's props, for a bottom bar. */
    this.cardAbove = props()?.card === "above";
    /** @type {number} counts hover changes, so timers from an older change do nothing */
    this.hoverTurn = 0;
    /** @type {number} the slot's width, so the title can be cut to fit */
    this.width = 0;
    /** @type {unknown} the sign-in change stamp last seen */
    this.authStamp = authChangeStamp();
    /** @type {unknown} the dialog-opened stamp last seen */
    this.dialogStamp = dialogOpenStamp();
    this.now.start(cx);
  }

  /** @param {boolean} open */
  setCardOpen(open) {
    this.cardOpen = open;
    // The card shows progress, volume and modes, so those need redraws only while it is open.
    this.now.detailed = open;
    if (!open) { this.now.message = null; this.hoverRegions.clear(); }
  }

  /**
   * The pointer came onto, or left, one part of the slot or its card. The card opens after a
   * short rest on the slot and closes a moment after the pointer has left every part.
   * @param {string} region which part reports @param {boolean} on @param {Context} cx
   */
  hover(region, on, cx) {
    if (on) this.hoverRegions.add(region); else this.hoverRegions.delete(region);
    on = this.hoverRegions.size > 0;
    if (on === this.hovered) return;
    this.hovered = on;
    // Each change gets a number, so a timer started by an older change does nothing.
    const turn = ++this.hoverTurn;
    if (!on) return this.closeCardSoon(cx, CARD_CLOSE_DELAY);
    if (this.cardOpen) return;
    cx.timer.after(CARD_OPEN_DELAY, (cx) => {
      if (turn !== this.hoverTurn) return;
      this.setCardOpen(true);
      this.now.read(cx);
      cx.notify();
    });
  }

  /** Closes the card at once and drops any open or close that was on its way. */
  closeCardNow() {
    this.hoverTurn += 1;
    this.hovered = false;
    this.setCardOpen(false);
  }

  /** Closes the card after `ms`, unless the pointer comes back or a slider is being dragged. @param {Context} cx @param {number} ms */
  closeCardSoon(cx, ms) {
    const turn = this.hoverTurn;
    cx.timer.after(ms, (cx) => {
      if (turn !== this.hoverTurn || this.hovered) return;
      // Herdr can report the pointer as gone while it drags a slider. The release decides then.
      if (this.now.seek.dragging || this.now.volume.dragging) return;
      this.setCardOpen(false);
      cx.notify();
    });
  }

  /**
   * A slider was let go. If Herdr reported the pointer as gone during the drag, it reports it
   * back on the next movement over the card. Close only if that does not happen.
   * @param {Context} cx
   */
  sliderReleased(cx) {
    if (!this.hovered) this.closeCardSoon(cx, CARD_AFTER_DRAG_DELAY);
  }

  /** @param {Context} cx */
  render(cx) {
    // A sign-in or sign-out in the dialog changes the stamp and redraws every copy: read again at once.
    const stamp = authChangeStamp();
    if (stamp !== this.authStamp) { this.authStamp = stamp; this.now.read(cx); }
    // The dialog opened (by a click on the slot or by its key): it replaces the card.
    const opened = dialogOpenStamp();
    if (opened !== this.dialogStamp) { this.dialogStamp = opened; this.closeCardNow(); }
    return slotView(this, colors(), {
      open: () => run("mod.open", { name: MOD }),
      hover: (region, on, cx) => this.hover(region, on, cx),
      resize: (width, cx) => { if (width !== this.width) { this.width = width; cx.notify(); } },
    });
  }
}
