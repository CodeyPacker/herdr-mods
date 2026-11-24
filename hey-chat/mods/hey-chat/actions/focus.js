// Where the keyboard is: the message box, the permission bar, or the sidebar tree.
import { SIDEBAR_HIDDEN, remember } from "../common.js";

export const focus = {
  /** Gives the open chat's message box the keyboard, or the permission bar when one is waiting. */
  focusInput() {
    if (this.waiting(this.chat(this.chatId))) { this.zone = "ask"; this.handle.focus(); return; }
    this.zone = "chat";
    this.inputFor(this.chat(this.chatId).agent).focus();
  },

  /**
   * Gives the keyboard back to where it last was, for when the pane is picked again (another tab
   * or pane had it). An open dialog, the tree and the search boxes keep it, the zone says which.
   */
  regainFocus() {
    if (this.setupOpen) this.handle.focus();
    else if (this.zone === "chat" || this.zone === "ask") this.focusInput();
    else if (this.zone === "search") this.searchInput.focus();
    else if (this.zone === "chat-search") this.chatSearchInput.focus();
    else if (this.zone === "settings") this.initialsInput.focus();
    else this.handle.focus(); // tree, confirm, dialog
  },

  /** Hides or shows the sidebar (ctrl-b), and remembers it. Hiding it takes the keyboard to the message box. */
  toggleSidebar() {
    this.setSidebarHidden(!this.sidebarHidden);
    if (this.sidebarHidden && ["tree", "search"].includes(this.zone)) this.focusInput();
  },

  /** @param {boolean} hidden */
  setSidebarHidden(hidden) {
    this.sidebarHidden = hidden;
    remember(SIDEBAR_HIDDEN, hidden);
  },

  /** Gives the tree the keyboard, its cursor on the open chat (or its project, when that is closed). Shows a hidden sidebar. */
  focusTree() {
    if (this.sidebarHidden) this.setSidebarHidden(false);
    const project = this.chat(this.chatId).project;
    this.cursor = this.collapsed[project] ? `p:${project}` : `c:${this.chatId}`;
    this.zone = "tree";
    this.handle.focus();
    this.revealCursor();
  },

  /** Scrolls the sidebar so the cursor's row shows. */
  revealCursor() {
    const i = this.treeKeys.indexOf(this.cursor);
    if (i >= 0) this.treeScroll.scroll_to_item(i);
  },
};
