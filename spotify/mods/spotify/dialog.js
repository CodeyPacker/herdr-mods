// The Spotify dialog's shell. It draws the frame, owns the keyboard, and shows one of two
// parts: the sign-in screens (signin.js) or the player with its lists (browser.js).
import { div } from "gpui-kit";
import { props, closeOverlay } from "herdr";
import { freshAuth, signOut } from "./auth.js";
import { loadAuth } from "./store.js";
import { markAuthChanged, markDialogOpened } from "./signals.js";
import { colors, SIZE } from "./kit/theme.js";
import { frame } from "./kit/frame.js";
import { iconPath } from "./ui.js";
import { SPOTIFY_GREEN } from "./constants.js";
import { SignIn } from "./signin.js";
import { Browser } from "./browser.js";

/** @typedef {import("gpui-kit").Context} Context */

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
    return this.width - SIZE.framePad * 2;
  }

  /** @param {Context} _cx */
  render(_cx) {
    const t = colors();
    const body = this.part ? this.part.render(t) : div().text_size(12.5).text_color(t.dim).child("Loading…");
    return frame(t, {
      id: "spotify",
      title: "Spotify",
      icon: iconPath("spotify"),
      iconColor: SPOTIFY_GREEN,
      handle: this.handle,
      fill: true,
      onKey: (e, cx) => this.part?.key(e, cx),
      onResize: (width, cx) => { if (width !== this.width) { this.width = width; cx.notify(); } },
    }).child(body);
  }
}
