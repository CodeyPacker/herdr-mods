// The Files panel: the files and links a conversation produced, and their previews.
import { home } from "herdr";
import { imageFile, outputFileAction } from "../agent.js";
import { collectOutputs, webOutput } from "../outputs.js";

/** How long the "new file" toast shows. */
const TOAST_MS = 4000;

export const outputs = {
  /**
   * Discover outputs after a tool or turn finishes, rather than on every render. With
   * `announce`, a file or link that is new to the open chat shows a toast for a few seconds.
   * @param {any} chat @param {any} [cx] @param {boolean} [announce]
   */
  syncOutputs(chat, cx, announce = false) {
    const found = collectOutputs(chat, home());
    const before = chat.outputs ?? [];
    if (JSON.stringify(found) === JSON.stringify(before)) return;
    chat.outputs = found;
    if (cx && this.outputsOpen && this.chatId === chat.id && chat.outputKey) this.selectOutput(chat.outputKey, cx);
    if (this.loaded) this.saveChats();
    const added = found.filter((/** @type {any} */ o) => !before.some((/** @type {any} */ b) => b.key === o.key));
    if (announce && cx && added.length && chat.id === this.chatId && !this.outputsOpen) this.toastOutputs(chat, added, cx);
  },

  /** Shows the toast for new outputs, and hides it a few seconds later. @param {any} chat @param {any[]} added @param {any} cx */
  toastOutputs(chat, added, cx) {
    const toast = this.outputToast = { chat: chat.id, text: added.length === 1 ? `New: ${added[0].label}` : `${added.length} new files & links` };
    cx.timer.after(TOAST_MS, (/** @type {any} */ cx) => {
      if (this.outputToast !== toast) return;
      this.outputToast = null;
      cx.notify();
    });
  },

  /** Opens or closes the panel. Opening it shows the last output picked, else the newest. @param {any} cx */
  toggleOutputs(cx) {
    this.outputsOpen = !this.outputsOpen;
    this.outputToast = null;
    if (!this.outputsOpen) return;
    const chat = this.chat(this.chatId);
    this.syncOutputs(chat, cx);
    const first = (chat.outputs ?? []).find((/** @type {any} */ o) => o.key === chat.outputKey) ?? chat.outputs?.[0];
    if (first) this.selectOutput(first.key, cx);
  },

  /** Adds the web link on the clipboard to the conversation's outputs. @param {any} cx */
  addOutputLink(cx) {
    const chat = this.chat(this.chatId);
    const output = webOutput((cx.read_from_clipboard() ?? "").trim());
    if (!output) { this.outputError = "Copy an http or https link first, then try again."; return; }
    chat.outputs = [...(chat.outputs ?? []).filter((/** @type {any} */ o) => o.key !== output.key), { ...output, updated: Date.now(), message: "attached" }];
    this.outputError = null;
    this.saveChats();
    this.selectOutput(output.key, cx);
  },

  /**
   * Picks an output and loads its preview. A slower earlier load, or one for another
   * conversation, never replaces it.
   * @param {string} key @param {any} cx
   */
  selectOutput(key, cx) {
    const chat = this.chat(this.chatId);
    const output = chat.outputs?.find((/** @type {any} */ o) => o.key === key);
    if (!output) return;
    chat.outputKey = key;
    this.outputError = null;
    this.outputPreview = null;
    if (output.kind === "link") return;
    const request = {};
    this.outputRequest = request;
    cx.spawn(async (/** @type {any} */ cx) => {
      let preview;
      try {
        preview = output.kind === "image" ? { ...await imageFile(output.target), kind: "image" } : await outputFileAction("read", output.target);
      } catch { preview = { error: "Couldn't read this file. It may have moved or been deleted." }; }
      if (this.outputRequest !== request || this.chatId !== chat.id || chat.outputKey !== key) return;
      this.outputPreview = { ...preview, key, chat: chat.id, version: Date.now() };
      cx.notify();
    });
  },

  /** Opens the picked output, or shows it in its folder ("reveal"). @param {"open" | "reveal"} action @param {any} cx */
  openOutput(action, cx) {
    const chat = this.chat(this.chatId);
    const output = chat.outputs?.find((/** @type {any} */ o) => o.key === chat.outputKey);
    if (!output) return;
    if (output.kind === "link") { cx.open_url(output.target); return; }
    cx.spawn(async (/** @type {any} */ cx) => {
      try { await outputFileAction(action, output.target); }
      catch (error) { if (this.chatId === chat.id) this.outputError = error instanceof Error ? error.message : "Couldn't open this output."; }
      cx.notify();
    });
  },
};
