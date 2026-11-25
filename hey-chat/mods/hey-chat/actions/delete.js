// Deleting chats: one, every chat in a folder, or the chats selected in the tree. Each asks first.
import { home, spaces, run } from "herdr";
import { QUICK_TAB } from "../tabs.js";
import { deleteSession } from "../agent.js";
import { treeItems } from "../keys.js";
import { COLLAPSED, errorText, remember } from "../common.js";

export const deleting = {
  /**
   * Shows the delete question (y / n) in the sidebar. `what` names the chat (`id`), the folder
   * (`project`) or the selected chats (`ids`).
   * @param {any} what
   */
  confirmDeleteOf(what) {
    if (this.sidebarHidden) this.setSidebarHidden(false);
    this.deleting = { ...what, back: this.zone === "tree" ? "tree" : "chat", busy: false, error: null, done: 0 };
    this.zone = "confirm";
    this.handle.focus();
  },

  /** Closes a quick chat's tab. Closing it deletes the chat (main.js close). */
  closeQuick() {
    // The trash was just clicked, so the focused pane is this one. Only a tab that is a quick chat's
    // is closed: a tab.close with no id would close whichever tab is focused.
    this.learnPane();
    const tab = this.ownPane()?.tab;
    const isQuick = tab && spaces().some((s) => s.tabs.some((t) => t.id === tab && t.name === QUICK_TAB));
    if (isQuick) run("tab.close", { id: tab });
  },

  /** Asks whether to delete a chat (y / n). @param {string} id */
  askDelete(id) {
    if (this.chats.some((/** @type {any} */ c) => c.id === id)) this.confirmDeleteOf({ id });
  },

  /** Asks whether to delete every chat in a folder (y / n). The folder on disk is never touched. @param {string} project */
  askDeleteProject(project) {
    if (this.projects.some((/** @type {any} */ p) => p.id === project)) this.confirmDeleteOf({ project });
  },

  /** The chats a selection covers, from the anchor to the cursor in sidebar order. A chat in Recent and its folder counts once. */
  selectedIds() {
    if (!this.anchor) return [];
    const items = treeItems(this);
    const a = items.indexOf(this.anchor), b = items.indexOf(this.cursor);
    if (a < 0 || b < 0) return [];
    const ids = items.slice(Math.min(a, b), Math.max(a, b) + 1).filter((k) => !k.startsWith("p:")).map((k) => k.slice(2));
    return [...new Set(ids)];
  },

  /** Asks whether to delete the selected chats (y / n). */
  askDeleteSelected() {
    const ids = this.selectedIds();
    if (ids.length === 0) return;
    if (ids.length === 1) { this.anchor = null; this.askDelete(ids[0]); return; }
    this.confirmDeleteOf({ ids });
  },

  /** Puts the question away. */
  cancelDelete() {
    const back = this.deleting?.back;
    this.deleting = null;
    if (back === "tree") { this.zone = "tree"; this.handle.focus(); } else this.focusInput();
  },

  /** Stops the chat's agent before deleting its session. @param {any} chat */
  async removeChatSession(chat) {
    try {
      await this.links.get(chat.id);
      await this.quitBridge(chat);
      return chat.session ? await deleteSession(chat.agent, chat.session, chat.file ?? null) : { ok: true };
    } catch (e) {
      return { ok: false, message: errorText(e) };
    }
  },

  /** Deletes the confirmed chat and opens the next one. @param {any} cx */
  confirmDelete(cx) {
    const d = this.deleting;
    if (!d || d.busy) return;
    if (d.project || d.ids) { this.confirmDeleteMany(cx); return; }
    const chat = this.chats.find((/** @type {any} */ c) => c.id === d.id);
    if (!chat) { this.cancelDelete(); return; }
    d.busy = true; d.error = null;
    cx.spawn(async (/** @type {any} */ cx) => {
      const r = await this.removeChatSession(chat);
      if (!r.ok) { d.busy = false; d.error = r.message || "Couldn't delete it."; cx.notify(); return; }
      this.chats = this.chats.filter((/** @type {any} */ c) => c.id !== chat.id);
      this.saveChats();
      this.deleting = null;
      if (this.chatId === chat.id) {
        const next = this.chatsIn(chat.project)[0];
        if (next) this.openChat(next.id, cx); else this.newChat(chat.project, cx);
      }
      if (d.back === "tree") this.focusTree(); else this.focusInput();
      cx.notify();
    });
  },

  /**
   * Deletes several chats one at a time, as deleting one chat does: every chat in a folder (the
   * folder then leaves the sidebar), or the selected chats. A chat that can't be deleted stays,
   * and the question shows why.
   * @param {any} cx
   */
  confirmDeleteMany(cx) {
    const d = this.deleting;
    const chats = d.project ? this.chats.filter((/** @type {any} */ c) => c.project === d.project) : this.chats.filter((/** @type {any} */ c) => d.ids.includes(c.id));
    d.busy = true; d.error = null; d.done = 0; d.total = chats.length;
    cx.spawn(async (/** @type {any} */ cx) => {
      /** @type {string[]} */
      const failed = [];
      for (const chat of chats) {
        const r = await this.removeChatSession(chat);
        if (!r.ok) { failed.push(`${chat.title}: ${r.message || "couldn't delete it"}`); continue; }
        this.chats = this.chats.filter((/** @type {any} */ c) => c.id !== chat.id);
        d.done += 1;
        cx.notify();
      }
      this.saveChats();
      this.anchor = null;
      if (failed.length > 0) { d.busy = false; d.error = failed.slice(0, 3).join("\n"); cx.notify(); return; }
      if (d.project) {
        this.projects = this.projects.filter((/** @type {any} */ p) => p.id !== d.project);
        const { [d.project]: _gone, ...rest } = this.collapsed;
        this.collapsed = rest;
        remember(COLLAPSED, this.collapsed);
        this.saveChats(); // again, now that a project you made is gone too
      }
      this.deleting = null;
      if (!this.chats.some((/** @type {any} */ c) => c.id === this.chatId)) {
        const next = this.chats.slice().sort((/** @type {any} */ a, /** @type {any} */ b) => b.stamp - a.stamp)[0];
        if (next) this.openChat(next.id, cx);
        else { const id = this.addProject(this.folder ?? home()); this.newChat(id, cx); }
      }
      if (d.back === "tree") this.focusTree(); else this.focusInput();
      cx.notify();
    });
  },
};
