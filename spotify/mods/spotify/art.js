// Album art. The mod's fetch cannot return pictures, so curl saves each one under
// ~/.config/herdr-app/data/spotify/art/ and image() draws it from there.
import { exec, appHome } from "herdr";
import * as fs from "fs/promises";
import { MOD, ART_URL_PATTERN } from "./constants.js";

/** @typedef {import("./player.js").Picture} Picture */

/** The folder, relative to the app's home, which is how image() wants paths. */
const ART_DIR = `data/${MOD}/art`;
const absolute = (/** @type {string} */ relative) => `${appHome()}/${relative}`.replace(/\\/g, "/");

/** Picture IDs already saved, so each picture is checked on disk once per run. @type {Set<string>} */
const saved = new Set();

/**
 * Saves the picture if it is not saved yet. Returns its path for image(), or null when
 * there is no picture or the download failed.
 * @param {Picture | null} art
 * @returns {Promise<string | null>}
 */
export async function artFile(art) {
  // The address goes to curl and the ID into a file name, so both must be the plain shape Spotify uses.
  if (!art || !ART_URL_PATTERN.test(art.url) || !/^[A-Za-z0-9]+$/.test(art.id)) return null;
  const relative = `${ART_DIR}/${art.id}.jpg`;
  if (saved.has(art.id)) return relative;
  if (!(await fs.exists(absolute(relative)))) {
    try {
      await fs.mkdir(absolute(ART_DIR), { recursive: true });
      const r = await exec("curl", ["--silent", "--fail", "--max-time", "10", "--output", absolute(relative), art.url], { timeout: 15000 });
      if (r.code !== 0) return null;
    } catch { return null; }
  }
  saved.add(art.id);
  return relative;
}
