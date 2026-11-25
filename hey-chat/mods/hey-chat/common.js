// Small pieces the rest of the mod shares: where its files live, the settings it keeps, and
// helpers for paths and errors.
import { appHome, checking, setShared } from "herdr";

/** The mod's icons, from Herdr's home. */
export const ICONS = "mods/hey-chat/icons";

/** Which projects are closed in the tree, kept across panes and restarts: { [project]: true }. */
export const COLLAPSED = "hey-chat.collapsed";
/** Whether the sidebar is hidden (ctrl-b), kept across panes and restarts. */
export const SIDEBAR_HIDDEN = "hey-chat.sidebarHidden";
/** Hide routine tool activity unless the user turns it back on in Settings. */
export const CONDENSE_CHAT = "hey-chat.condenseChat";
/** Show the agent's plan above the message box while it works, on unless turned off in Settings. */
export const SHOW_PLAN = "hey-chat.showPlan";

/** Herdr's home, with forward slashes. */
export function appDir() {
  return appHome().replace(/\\/g, "/");
}

/** The mod's data folder: <appHome>/data/hey-chat. */
export function dataDir() {
  return `${appDir()}/data/hey-chat`;
}

/** Where quick chats run: one empty folder each, deleted with the chat. */
export function quickDir() {
  return `${dataDir()}/quick`;
}

/** One of the mod's Node programs. @param {string} name */
export function script(name) {
  return `${appDir()}/mods/hey-chat/${name}`;
}

/** A folder as the mod keys it: forward slashes and no slash at the end. @param {string} path */
export function normalFolder(path) {
  return path.replace(/\\/g, "/").replace(/\/$/, "") || "/";
}

/** A folder's last part. @param {string} path */
export function folderName(path) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** An error's message, for the chat. @param {unknown} e */
export function errorText(e) {
  return e instanceof Error ? e.message : String(e);
}

/** Keeps a setting across panes and restarts. `herdr-app check` saves nothing. @param {string} key @param {any} value */
export function remember(key, value) {
  if (!checking()) setShared(key, value);
}
