// Jumping between chats: ⌃g opens a chat that needs you (a permission or a question) or one whose
// turn finished while you were elsewhere, and ⌃o switches between the chat you're in and the one
// you were in before.

export const jump = {
  /**
   * The chat ⌃g opens, or null: the next chat after the open one, in list order and wrapping
   * around, that waits on you or finished while you were elsewhere (unread). Pressing again goes
   * through every one of them.
   */
  jumpTarget() {
    const at = this.chats.findIndex((/** @type {any} */ c) => c.id === this.chatId);
    const order = [...this.chats.slice(at + 1), ...this.chats.slice(0, Math.max(at, 0))];
    return order.find((/** @type {any} */ c) => this.needsYou(c) || this.unread[c.id])?.id ?? null;
  },

  /** ⌃g: opens the next chat that needs you or just finished. @param {any} cx */
  jumpToFresh(cx) {
    const id = this.jumpTarget();
    if (id) this.openChat(id, cx);
  },

  /**
   * Records a move from one chat to another: the chat you left is the one ⌃o goes back to.
   * @param {string} from @param {string} to
   */
  noteVisit(from, to) {
    if (from && from !== to) this.previous = from;
  },

  /** ⌃o: back to the chat you were in before. Pressed again, it comes back here. @param {any} cx */
  switchBack(cx) {
    const id = this.previous;
    if (id && id !== this.chatId && this.chats.some((/** @type {any} */ c) => c.id === id)) this.openChat(id, cx);
  },
};
