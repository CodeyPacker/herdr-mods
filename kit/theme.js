// The kit: the look and the building blocks every mod in this repo shares.
//
// This folder at the repo root is the one place to edit. A mod can only import from its own
// folder, so `node scripts/sync-kit.mjs` copies it into each mod as `mods/<name>/kit/`, and
// mods import from "./kit/...". Never edit a copy: the next sync overwrites it.
//
// This file: the theme's colors and the sizes the other kit files draw with.
import { theme } from "herdr";

/** @typedef {import("gpui-kit").Color} Color */
/** @typedef {Record<string, Color>} Theme */

/** The app's theme colors by name, typed as colors the builders accept. @returns {Theme} */
export function colors() {
  return /** @type {Theme} */ (theme());
}

/** Sizes in pixels. One table, so every mod's frame, rows and text match. */
export const SIZE = {
  /** The space between a frame's edge and its content. */
  framePad: 22,
  /** The space between a frame's sections. */
  frameGap: 14,
  frameRadius: 16,
  /** The space between a pane's edge and its content, sideways. A pane is tighter than a frame. */
  panePad: 14,
  /** A list row, and the tighter row for long lists. */
  row: 38,
  compactRow: 32,
  /** A row with a second, dim line under its name. */
  tallRow: 48,
  rowRadius: 8,
  /** Text: a frame's title, a list row, and small print such as key hints. */
  title: 16,
  text: 13.5,
  small: 11,
};
