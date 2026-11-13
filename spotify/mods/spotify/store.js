// The saved sign-in, in ~/.config/herdr-app/data/spotify/auth.json. A file, not localStorage,
// because the status slot and the dialog are separate copies of the mod and both need it.
// It holds the refresh token in plain text, so it stays out of the mod's own folder.
import { appHome, readTextFile, writeTextFile } from "herdr";
import * as fs from "fs/promises";
import { MOD } from "./constants.js";

/**
 * `client_id` alone means signed out with the ID remembered.
 * @typedef {{ client_id: string, access_token?: string, refresh_token?: string, expires_at?: number }} Auth
 */

const dir = () => `${appHome()}/data/${MOD}`.replace(/\\/g, "/");
const path = () => `${dir()}/auth.json`;

/** @returns {Promise<Auth | null>} */
export async function loadAuth() {
  try {
    const auth = JSON.parse((await readTextFile(path())) ?? "null");
    return auth && typeof auth.client_id === "string" ? auth : null;
  } catch { return null; }
}

/** @param {Auth} auth */
export async function saveAuth(auth) {
  await fs.mkdir(dir(), { recursive: true });
  // writeTextFile only replaces a file when handed its current text (null means it must not exist yet).
  await writeTextFile(path(), JSON.stringify(auth), await readTextFile(path()));
}

/** @param {Auth | null} auth */
export function isSignedIn(auth) {
  return Boolean(auth?.refresh_token);
}
