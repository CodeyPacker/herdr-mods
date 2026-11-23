// The messages: which rows show, keeping the newest on screen, the loading cover, and finding text.
import { visibleMessages } from "../messages.js";
import { LIST_PAD_TOP, LIST_PAD_BOTTOM } from "../keys.js";

export const scroll = {
  /** The messages shown after applying the profile setting. @param {any} chat */
  visibleThread(chat) { return visibleMessages(chat, this.condenseChat !== false); },

  /** The open chat's message rows in order, by id, as the keys see them. */
  rowIds() {
    const chat = this.chat(this.chatId);
    const ids = this.visibleThread(chat).map((/** @type {any} */ m) => m.id);
    if (this.thinking(chat) && !this.needsYou(chat)) ids.push("typing");
    return ids;
  },

  /** Puts the newest message on screen, then corrects its position after changed rows are laid out. @param {any} [cx] */
  scrollDown(cx) {
    const n = this.rowIds().length;
    // The final direct child is a bottom marker, even when the last message is taller than the viewport.
    if (n > 0) this.scroll.scroll_to_item(n);
    this.atBottom = true;
    if (cx?.timer && !this.bottomScrollPending) {
      const chatId = this.chatId;
      this.bottomScrollPending = true;
      cx.timer.after(16, (cx) => {
        this.bottomScrollPending = false;
        if (this.chatId !== chatId || !this.atBottom) return;
        this.scrollDown();
        cx.notify();
      });
    }
  },

  /** Reapply bottom anchoring once a message's actual layout height is known. @param {string} key @param {number} height @param {any} cx */
  measureRow(key, height, cx) {
    if (this.rowHeights.get(key) === height) return;
    this.rowHeights.set(key, height);
    if (this.atBottom) { this.scrollDown(); cx.notify(); }
    this.settleRestore(cx);
  },

  /** Keep the tail visible after the composer or window changes height. @param {number} height @param {any} cx */
  measureViewport(height, cx) {
    if (this.viewH === height) return;
    this.viewH = height;
    if (this.atBottom) { this.scrollDown(); cx.notify(); }
    this.settleRestore(cx);
  },

  /** Keep the cover until layout stays stable through the final scroll. @param {any} cx */
  settleRestore(cx) {
    const restore = this.restoring;
    if (!restore || restore.pending) return;
    ++restore.version;
    if (restore.scheduled) return;
    restore.scheduled = true;
    let version = restore.version;
    let frames = 0;
    const settle = (/** @type {any} */ cx) => {
      if (this.restoring !== restore) return;
      if (restore.version !== version && ++frames < 8) {
        version = restore.version;
        cx.timer.after(32, settle);
        return;
      }
      this.scrollDown();
      cx.notify();
      version = restore.version;
      // Timer callbacks must use their own context. Layout's context expires on return.
      cx.timer.after(32, (/** @type {any} */ cx) => {
        if (this.restoring !== restore) return;
        // A post-scroll measurement can change the viewport again. Keep that correction covered.
        if (restore.version !== version && ++frames < 8) {
          version = restore.version;
          settle(cx);
          return;
        }
        this.restoring = null;
        cx.notify();
      });
    };
    cx.timer.after(32, settle);
  },

  /** Track manual scrolling so following resumes when the user returns to the bottom. @param {number} dy */
  trackMessageScroll(dy) {
    const height = this.rowIds().reduce((sum, id) => sum + (this.rowHeights.get(id) ?? 0), 0);
    const max = Math.max(0, LIST_PAD_TOP + height + LIST_PAD_BOTTOM + 1 - this.viewH);
    this.top = Math.max(0, Math.min(max, (this.atBottom ? max : this.top) - dy));
    this.atBottom = this.top >= max - 1;
  },

  /** The open chat's rows, by index, whose text holds what the find box has. */
  chatMatches() {
    const query = this.chatSearchInput.value().trim().toLowerCase();
    if (!query) return [];
    return this.visibleThread(this.chat(this.chatId)).flatMap((/** @type {any} */ m, /** @type {number} */ index) => {
      const text = [m.text, m.title, ...(m.lines ?? []), ...(m.questions ?? []).map((/** @type {any} */ q) => q.question)].filter(Boolean).join("\n");
      return text.toLowerCase().includes(query) ? [index] : [];
    });
  },

  /** Scrolls to the next (1) or previous (-1) match, wrapping around. @param {number} direction */
  findChatMatch(direction) {
    const matches = this.chatMatches();
    if (!matches.length) { this.chatSearchIndex = 0; return; }
    this.chatSearchIndex = ((this.chatSearchIndex + direction) % matches.length + matches.length) % matches.length;
    this.atBottom = false;
    this.scroll.scroll_to_item(matches[this.chatSearchIndex]);
  },

  /** Opens or closes the find box, and moves the keyboard to it or back to the message box. */
  toggleChatSearch() {
    this.chatSearchOpen = !this.chatSearchOpen;
    if (this.chatSearchOpen) this.chatSearchInput.focus();
    else this.focusInput();
  },
};
