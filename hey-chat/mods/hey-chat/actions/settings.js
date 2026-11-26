// Settings: General preferences, message colors in Theme, and configurable Shortcuts.
import { saveMe, pickPhoto, importPhoto, dropPhoto } from "../me.js";
import { keyLabel } from "../shortcuts.js";
import { CONDENSE_CHAT, SHOW_PLAN, remember } from "../common.js";
import { InputState } from "gpui-base";
import { COLOR_FIELDS, loadMessageColors, saveMessageColor, resetMessageColors } from "../message-colors.js";

/** The kit's option for whether key hints show. */
const HINTS = "hints";

export const settings = {
  /** True when this key press is shortcut `id`'s and the shortcut is on. @param {string} id @param {import("gpui-kit").KeyEvent} e */
  pressed(id, e) {
    const s = this.shortcuts;
    if (s.matches(id, e.keystroke)) return true;
    // Some systems spell shift with a letter as the capital letter alone.
    return /^[A-Z]$/.test(e.key ?? "") && s.matches(id, `shift-${e.key.toLowerCase()}`);
  },

  /** A shortcut's key as buttons and hints show it, or "" when it is off or key hints are hidden. @param {string} id */
  keyHint(id) {
    return keyLabel(this.shortcuts.shown(id));
  },

  /** Shows only conversation and file edits, and remembers the setting. */
  toggleCondenseChat() {
    this.condenseChat = !this.condenseChat;
    remember(CONDENSE_CHAT, this.condenseChat);
    this.scrollDown();
  },

  /** Shows or hides the plan box, and remembers it. Separate from Condense chat. */
  toggleShowPlan() {
    this.showPlan = !this.showPlan;
    remember(SHOW_PLAN, this.showPlan);
  },

  /** Shows or hides the key hints, and remembers it. */
  toggleKeyHints() {
    this.shortcuts.setOption(HINTS, !this.shortcuts.showHints);
  },

  /** A shortcut or option changed in the Shortcuts tab. @param {string} id @param {boolean} on */
  shortcutChanged(id, on) {
    if (id === HINTS) this.keyHints = on;
  },

  /** Opens or closes Settings. */
  toggleSettings() {
    if (this.settingsOpen) this.closeSettings();
    else this.openSettings();
  },

  /** Opens Settings on the tab it was last on. The keyboard goes to the dialog, so typing doesn't reach the chat behind it. */
  openSettings() {
    this.settingsOpen = true;
    this.photoError = null;
    this.zone = "dialog";
    this.handle.focus();
    if (this.settingsTab === "shortcuts") this.shortcuts.show();
    if (this.settingsTab === "theme") this.prepareMessageColors();
  },

  /** Closes Settings and gives the message box the keyboard back. */
  closeSettings() {
    this.settingsOpen = false;
    this.shortcuts.hide();
    this.focusInput();
  },

  /** Shows General, Theme or Shortcuts. The Shortcuts tab takes the keys while it shows. @param {string} tab */
  setSettingsTab(tab) {
    this.settingsTab = tab;
    if (tab === "theme") this.prepareMessageColors();
    if (tab === "shortcuts") { this.shortcuts.show(); this.zone = "dialog"; this.handle.focus(); }
    else this.shortcuts.hide();
  },

  prepareMessageColors() {
    const saved = loadMessageColors();
    this.messageColorErrors = {};
    this.messageColorInputs ??= Object.fromEntries(COLOR_FIELDS.map(field => {
      const input = InputState.new({placeholder:"Theme default"});
      input.on("focus", (_e, cx) => { this.zone = "dialog"; cx.notify(); });
      input.on("change", (_e, cx) => { this.setMessageColor(field, input.value()); cx.notify(); });
      return [field, input];
    }));
    for (const field of COLOR_FIELDS) this.messageColorInputs[field].set_value(saved[field] ?? "");
  },

  setMessageColor(field, value) {
    this.messageColorErrors ??= {};
    if (!saveMessageColor(field, value)) {
      this.messageColorErrors[field] = "Use a hex color, such as #2563eb or #2563eb80.";
      return;
    }
    delete this.messageColorErrors[field];
    const input = this.messageColorInputs?.[field];
    if (input && input.value() !== value) input.set_value(value);
  },

  resetMessageColors() {
    resetMessageColors();
    this.prepareMessageColors();
  },

  /** Your picture: a built-in one's path, or null for initials. @param {string | null} picture */
  setPicture(picture) {
    const old = this.me.picture;
    this.me = { ...this.me, picture };
    this.photoError = null;
    saveMe(this.me);
    if (old !== picture) dropPhoto(old);
  },

  /** @param {string} color */
  setColor(color) {
    this.me = { ...this.me, color };
    saveMe(this.me);
  },

  /** Your initials as typed in Settings: one or two letters, upper case. @param {any} cx */
  setInitials(cx) {
    const raw = this.initialsInput.value();
    const clean = raw.replace(/\s+/g, "").slice(0, 2).toUpperCase();
    if (clean !== raw) this.initialsInput.set_value(clean);
    this.me = { ...this.me, initials: clean };
    saveMe(this.me);
    cx.notify();
  },

  /** Asks for a photo with the system's file dialog and uses it. @param {any} cx */
  uploadPhoto(cx) {
    if (this.photoBusy) return;
    cx.spawn(async (/** @type {any} */ cx) => {
      // The file dialog. If it can't open (only Windows reports that), dropping a picture still works.
      let picked = null;
      try { picked = await pickPhoto(); }
      catch { this.photoError = "Couldn't open the file dialog. Drop a picture on this card to use it."; cx.notify(); return; }
      if (picked) await this.importPhoto(picked, cx);
    });
  },

  /** Uses a dropped file as your photo. @param {string | undefined} path @param {any} cx */
  usePhoto(path, cx) {
    if (!path || this.photoBusy) return;
    cx.spawn(async (/** @type {any} */ cx) => { await this.importPhoto(path, cx); });
  },

  /** Copies a photo in (me.js importPhoto) and makes it your picture. @param {string} path @param {any} cx */
  async importPhoto(path, cx) {
    this.photoBusy = true; this.photoError = null; cx.notify();
    try {
      const picture = await importPhoto(path, this.me.picture);
      this.me = { ...this.me, picture };
      saveMe(this.me);
    } catch (e) {
      this.photoError = e instanceof Error ? e.message : "Couldn't use that picture.";
    }
    this.photoBusy = false;
    cx.notify();
  },
};
