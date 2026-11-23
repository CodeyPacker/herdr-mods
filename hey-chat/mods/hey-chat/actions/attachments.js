// Images that go with the next message: pasted, pasted as a file path, or dropped on the chat.
import { window } from "herdr";
import { pasteImage, imageFile } from "../agent.js";

/** Adds an image to a chat's next message, replacing an earlier copy of it. @param {any} chat @param {{ path: string }} img */
function attach(chat, img) {
  chat.attached = [...(chat.attached ?? []).filter((/** @type {any} */ i) => i.path !== img.path), img];
}

export const attachments = {
  /**
   * Adds the clipboard's image (or the image file whose path was pasted) to the open chat's next
   * message, or says why it can't.
   * @param {any} cx @param {string | null} [file]
   */
  pasteImage(cx, file = null) {
    const chat = this.chat(this.chatId);
    if (!chat) return;
    cx.spawn(async (/** @type {any} */ cx) => {
      const r = await pasteImage(file);
      if ("error" in r) chat.pasteError = r.error;
      else { chat.pasteError = null; attach(chat, r); }
      cx.notify();
    });
  },

  /**
   * Messages and Finder copy an image as its file's path. When that path lands in the box from the
   * clipboard, it comes back out and the image goes with the next message instead.
   * @param {any} box @param {any} cx
   */
  pastedPath(box, cx) {
    const clip = String(cx.read_from_clipboard?.() ?? "").trim();
    const windows = window().platform === "windows";
    // Windows: a drive path (C:\…\shot.png). Explorer's "Copy as path" wraps it in quotes.
    const file = windows ? clip.replace(/^"(.*)"$/, "$1") : clip;
    const start = windows ? /^[a-z]:[\\/]/i : /^(\/|~\/)/;
    if (!start.test(file) || !/^[^\n]*\.(png|jpe?g|gif|webp)$/i.test(file)) return;
    const text = box.value();
    if (!text.includes(clip)) return;
    box.set_value(text.replace(clip, "").replace(/^\s+$/, ""));
    this.pasteImage(cx, file);
  },

  /**
   * Adds images dropped on the chat to its next message, in the order dropped. Files that aren't
   * images are left out, and the strip above the box says so.
   * @param {string[]} paths @param {any} cx
   */
  dropImages(paths, cx) {
    const chat = this.chat(this.chatId);
    if (!chat) return;
    cx.spawn(async (/** @type {any} */ cx) => {
      const errors = [];
      for (const file of paths) {
        const r = /\.(png|jpe?g|gif|webp)$/i.test(file) ? await imageFile(file) : { error: "Only images can be dropped here." };
        if ("error" in r) { errors.push(r.error); continue; }
        attach(chat, r);
        cx.notify();
      }
      chat.pasteError = errors[0] ?? null;
      this.focusInput();
      cx.notify();
    });
  },

  /** Takes an image back out of the next message. @param {string} path */
  unattach(path) {
    const chat = this.chat(this.chatId);
    if (chat) chat.attached = (chat.attached ?? []).filter((/** @type {any} */ i) => i.path !== path);
  },
};
