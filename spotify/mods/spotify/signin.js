// The dialog's sign-in part: which sign-in screen shows, and what each key does on it.
// The work is in pkce.js (login values), listener.js (catching the redirect) and auth.js (tokens).
import { InputState } from "gpui-base";
import { CLIENT_ID_PATTERN, DASHBOARD_URL, REDIRECT_URI, COPIED_MS } from "./constants.js";
import { newLoginAttempt, readRedirect } from "./pkce.js";
import { openAndWaitForRedirect } from "./listener.js";
import { finishLogin } from "./auth.js";
import { openUrl } from "./platform.js";
import { setupView, waitingView, pasteView } from "./views/signin.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("gpui-kit").KeyEvent} KeyEvent */
/** @typedef {import("./kit/theme.js").Theme} Theme */
/** @typedef {import("./dialog.js").Dialog} Dialog */
/** @typedef {"setup" | "waiting" | "paste"} Screen */

export class SignIn {
  /** @param {Dialog} dialog the shell: it owns the keyboard handle, closes the dialog and takes over once signed in */
  constructor(dialog) {
    this.dialog = dialog;
  }

  /**
   * @param {Context} _cx
   * @param {string} clientId the remembered client ID, or ""
   * @param {string | null} error shown in red, for example why a saved sign-in stopped working
   */
  init(_cx, clientId, error) {
    /** @type {Screen} */
    this.screen = "setup";
    /** @type {string | null} shown in red on the setup and paste screens */
    this.error = error;
    /** @type {import("./pkce.js").LoginAttempt | null} the login in progress */
    this.attempt = null;
    /** @type {"busy" | "missed"} why the paste screen is showing */
    this.pasteReason = "missed";
    /** @type {boolean} true for a moment after the redirect URI was copied */
    this.copied = false;
    /** @type {number} counts copies */
    this.copyTurn = 0;
    this.idInput = InputState.new({ value: clientId, placeholder: "Client ID" });
    this.idInput.on("submit", (_e, cx) => this.startLogin(cx));
    this.pasteInput = InputState.new({ value: "", placeholder: "http://127.0.0.1:…/callback?code=…" });
    this.pasteInput.on("submit", (_e, cx) => this.finishFromPaste(cx));
    this.show("setup");
  }

  /** Switches screen and gives the keyboard to that screen's text box, or to the dialog. @param {Screen} screen */
  show(screen) {
    this.screen = screen;
    if (screen === "setup") this.idInput.focus();
    else if (screen === "paste") this.pasteInput.focus();
    else this.dialog.handle.focus();
  }

  /** Opens the Spotify developer dashboard in the browser. */
  openDashboard() {
    openUrl(DASHBOARD_URL).catch(() => {});
  }

  /** Copies the redirect URI, so it can be pasted into Spotify's form without a typo. @param {Context} cx */
  copyRedirect(cx) {
    cx.write_to_clipboard(REDIRECT_URI);
    this.copied = true;
    cx.notify();
    // Each copy gets a number, so an older copy's timer does not hide a newer "Copied".
    const turn = ++this.copyTurn;
    cx.timer.after(COPIED_MS, (cx) => {
      if (turn !== this.copyTurn) return;
      this.copied = false;
      cx.notify();
    });
  }

  /** Checks the typed client ID, opens the browser and waits for Spotify's redirect. @param {Context} cx */
  startLogin(cx) {
    const clientId = this.idInput.value().trim();
    if (!CLIENT_ID_PATTERN.test(clientId)) {
      this.error = "A client ID is 32 letters and numbers. Copy it from your app's page in the dashboard.";
      cx.notify();
      return;
    }
    this.error = null;
    const attempt = this.attempt = newLoginAttempt(clientId);
    this.show("waiting");
    cx.notify();
    cx.spawn(async (cx) => {
      const result = await openAndWaitForRedirect(attempt.url);
      // Cancelled, or a newer attempt started, while this one waited.
      if (this.attempt !== attempt) return;
      if ("path" in result) await this.finish(attempt, result.path, cx);
      else {
        // The script only opens the browser when it could listen.
        if ("busy" in result) await openUrl(attempt.url).catch(() => {});
        this.pasteReason = "busy" in result ? "busy" : "missed";
        this.pasteInput.set_value("");
        this.show("paste");
      }
      cx.notify();
    });
  }

  /** @param {Context} cx */
  finishFromPaste(cx) {
    const attempt = this.attempt;
    if (!attempt) return;
    cx.spawn(async (cx) => { await this.finish(attempt, this.pasteInput.value(), cx); cx.notify(); });
  }

  /**
   * Turns the redirect into a saved sign-in and hands over to the dialog, or shows why it could not.
   * @param {import("./pkce.js").LoginAttempt} attempt
   * @param {string} redirect the listener's "/callback?..." or a pasted address
   * @param {Context} cx
   */
  async finish(attempt, redirect, cx) {
    const read = readRedirect(redirect, attempt.state);
    if ("error" in read) return this.fail(read.error);
    try {
      await finishLogin(attempt, read.code);
    } catch (e) {
      return this.fail(`Spotify refused the login: ${e instanceof Error ? e.message : e}`);
    }
    this.attempt = null;
    this.dialog.signedIn(cx);
  }

  /** A pasted address that is wrong keeps the paste screen. Anything else goes back to setup. @param {string} message */
  fail(message) {
    this.error = message;
    if (this.screen !== "paste") { this.attempt = null; this.show("setup"); }
  }

  /** @param {KeyEvent} e @param {Context} cx */
  key(e, cx) {
    const k = e.keystroke;
    if (this.screen === "setup") {
      // Every other key belongs to the client ID box.
      if (k === "ctrl-o" || k === "cmd-o") this.openDashboard();
      else if (k === "ctrl-r" || k === "cmd-r") this.copyRedirect(cx);
      else if (k === "escape") this.dialog.close();
      else return;
    } else if (k === "escape") {
      // Waiting or pasting: give up on this attempt.
      this.attempt = null;
      this.error = null;
      this.show("setup");
      cx.notify();
    } else return;
    cx.stop_propagation();
  }

  /** @param {Theme} t */
  render(t) {
    return this.screen === "setup" ? setupView(this, t) : this.screen === "waiting" ? waitingView(this, t) : pasteView(this, t);
  }
}
