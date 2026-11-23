// The copy button beside a message. It shows while the pointer is over the message, and for a
// moment after it leaves, so it can still be reached. A click copies the message's text.

/** How long the button stays after the pointer leaves, and how long "copied" shows. */
const LINGER_MS = 1500;

export const copy = {
  /**
   * The pointer moved onto (`on`) or off a message. One message shows the button at a time.
   * @param {string} id @param {boolean} on @param {any} cx
   */
  hoverMessage(id, on, cx) {
    if (on) {
      this.copyFor = id;
      ++this.copyLinger; // a message the pointer just left keeps it no longer
      cx.notify();
      return;
    }
    if (this.copyFor !== id) return;
    const linger = ++this.copyLinger;
    cx.timer.after(LINGER_MS, (/** @type {any} */ cx) => {
      if (this.copyLinger !== linger) return;
      this.copyFor = null;
      cx.notify();
    });
  },

  /** Copies a message's text, and shows a check on its button for a moment. @param {any} m @param {any} cx */
  copyMessage(m, cx) {
    cx.write_to_clipboard(String(m.text ?? ""));
    const copied = this.copied = { id: m.id };
    cx.timer.after(LINGER_MS, (/** @type {any} */ cx) => {
      if (this.copied !== copied) return;
      this.copied = null;
      cx.notify();
    });
  },
};
