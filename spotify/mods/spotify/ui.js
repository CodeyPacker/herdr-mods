// Small helpers the Spotify views share. The shared look and controls are in kit/.
import { MOD } from "./constants.js";

/** One of the mod's icons, as a path for svg(). @param {string} name */
export function iconPath(name) {
  return `mods/${MOD}/icons/${name}.svg`;
}

/** Milliseconds as m:ss. @param {number} ms */
export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
