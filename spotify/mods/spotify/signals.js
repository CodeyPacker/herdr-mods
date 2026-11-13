// How the dialog tells the slot that something happened. They are separate copies of the mod,
// so they talk through Herdr's shared values: setting one redraws every copy, and a copy
// notices by comparing the value with the one it saw last.
import { shared, setShared } from "herdr";
import { MOD } from "./constants.js";

const AUTH_CHANGED = `${MOD}.authChanged`;
const DIALOG_OPENED = `${MOD}.dialogOpened`;

/** Someone signed in or out, so the slot should read what is playing at once. */
export function markAuthChanged() {
  setShared(AUTH_CHANGED, Date.now());
}

/** Changes each time markAuthChanged runs. */
export function authChangeStamp() {
  return shared(AUTH_CHANGED);
}

/** The dialog opened, so the slot's hover card should close. */
export function markDialogOpened() {
  setShared(DIALOG_OPENED, Date.now());
}

/** Changes each time markDialogOpened runs. */
export function dialogOpenStamp() {
  return shared(DIALOG_OPENED);
}
