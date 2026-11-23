// Jumping between chats: ⌃g opens a chat whose turn just finished, and ⌃o switches between the
// chat you're in and the one you were in before.

/** How long a finished chat stays one ⌃g away. */
const FRESH_MS = 10 * 1000;

export const jump = {
  /**
   * A chat in the background finished its turn: for a while, ⌃g opens it. The newest goes first.
   * @param {string} id @param {any} cx
   */
  markFresh(id, cx) {
    this.fresh = [{ id, until: Date.now() + FRESH_MS }, ...this.fresh.filter((/** @type {any} */ f) => f.id !== id)];
    // Redraw when it expires, so its ⌃g badge goes away.
    cx.timer.after(FRESH_MS, (/** @type {any} */ cx) => cx.notify());
  },

  /** The chat ⌃g opens: the newest one that finished in the last few seconds, or null. */
  jumpTarget() {
    const now = Date.now();
    const f = this.fresh.find((/** @type {any} */ f) => f.until > now && f.id !== this.chatId && this.chats.some((/** @type {any} */ c) => c.id === f.id));
    return f?.id ?? null;
  },

  /** ⌃g: opens the chat that just finished. Pressed again, the one that finished before it. @param {any} cx */
  jumpToFresh(cx) {
    const id = this.jumpTarget();
    if (id) this.openChat(id, cx);
  },

  /**
   * Records a move from one chat to another: the chat you left is the one ⌃o goes back to, and
   * the one you opened no longer needs a ⌃g.
   * @param {string} from @param {string} to
   */
  noteVisit(from, to) {
    this.fresh = this.fresh.filter((/** @type {any} */ f) => f.id !== to);
    if (from && from !== to) this.previous = from;
  },

  /** ⌃o: back to the chat you were in before. Pressed again, it comes back here. @param {any} cx */
  switchBack(cx) {
    const id = this.previous;
    if (id && id !== this.chatId && this.chats.some((/** @type {any} */ c) => c.id === id)) this.openChat(id, cx);
  },
};
