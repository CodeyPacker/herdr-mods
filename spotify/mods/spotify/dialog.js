// The Spotify dialog's shell. It draws the frame, owns the keyboard, and shows one of two
// parts: the sign-in screens (signin.js) or the player with its lists (browser.js).
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay } from "herdr";
import { freshAuth, signOut } from "./auth.js";
import { loadAuth } from "./store.js";
import { markAuthChanged, markDialogOpened } from "./signals.js";
import { colors } from "./ui.js";
import { SignIn } from "./signin.js";
import { Browser } from "./browser.js";

/** @typedef {import("gpui-kit").Context} Context */

const PAD = 18;

export class Dialog {
  /** @param {Context} cx */
  init(cx) {
    /** @type {SignIn | Browser | null} null while the saved sign-in is being read */
    this.part = null;
    /** @type {number} the dialog's width, for the parts that need widths in pixels */
    this.width = 860;
    this.handle = cx.focus_handle();
    this.handle.focus();
    markDialogOpened();
    cx.spawn(async (cx) => { await this.load(cx); cx.notify(); });
  }

  /** Reads the saved sign-in and shows the player, or the sign-in screens when there is none. @param {Context} cx */
  async load(cx) {
    const saved = await loadAuth();
    /** @type {string | null} */
    let error = null;
    try {
      if (await freshAuth()) return this.showBrowser(cx);
    } catch (e) {
      error = `Spotify sign-in expired: ${e instanceof Error ? e.message : e}`;
    }
    this.showSignIn(cx, saved?.client_id ?? "", error);
  }

  /** @param {Context} cx */
  showBrowser(cx) {
    this.part = new Browser(this);
    this.part.init(cx);
  }

  /** @param {Context} cx @param {string} clientId @param {string | null} error */
  showSignIn(cx, clientId, error) {
    if (this.part instanceof Browser) this.part.stop();
    this.part = new SignIn(this);
    this.part.init(cx, clientId, error);
  }

  /** The sign-in part finished: tell the slot, and show the player. @param {Context} cx */
  signedIn(cx) {
    markAuthChanged();
    this.showBrowser(cx);
  }

  /** Forgets the tokens, keeps the client ID, and goes back to the sign-in screens. @param {Context} cx */
  signOut(cx) {
    cx.spawn(async (cx) => {
      const clientId = (await loadAuth())?.client_id ?? "";
      await signOut(clientId);
      markAuthChanged();
      this.showSignIn(cx, clientId, null);
      cx.notify();
    });
  }

  close() {
    closeOverlay(props().overlay);
  }

  /** The room inside the frame's padding. */
  innerWidth() {
    return this.width - PAD * 2;
  }

  /** @param {Context} _cx */
  render(_cx) {
    const t = colors();
    const body = this.part ? this.part.render(t) : div().text_size(12.5).text_color(t.dim).child("Loading…");
    return v_flex()
      .id("spotify")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.part?.key(e, cx))
      .on_size_change((size, cx) => { if (size.width !== this.width) { this.width = size.width; cx.notify(); } })
      .size_full()
      .p(PAD)
      .gap(12)
      .bg(t.popover)
      .rounded(14).overflow_hidden().border_1().border_color(t.border) // our own frame (mod.json says frame: none)
      .text_size(13)
      .child(h_flex().flex_none().items_center().gap(10)
        .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Spotify"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(body);
  }
}
