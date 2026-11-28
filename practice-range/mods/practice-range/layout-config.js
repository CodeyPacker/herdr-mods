// How Practice Range sits beside Neovim, saved as "layout" in practice-range.json.
import { parseConfig } from "./editor-config.js";

/** The panel's share of the tab can go from 30% to 70%. */
export const WIDTH_MIN = 0.3;
export const WIDTH_MAX = 0.7;

/** @type {import("./types.js").Layout} */
export const DEFAULT_LAYOUT = { side: "left", width: 0.5, compact: false, output: true };

/** A width inside the allowed range, rounded to whole percent. @param {number} width */
export function clampWidth(width) {
  return Math.round(Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, width)) * 100) / 100;
}

/**
 * The saved layout, with the default for anything missing. A value of the wrong kind is an
 * error, so a typo in the file is reported instead of quietly ignored.
 * @param {string | null} text @returns {import("./types.js").Layout}
 */
export function parseLayoutConfig(text) {
  const layout = parseConfig(text).layout;
  if (layout === undefined || layout === null) return { ...DEFAULT_LAYOUT };
  if (typeof layout !== "object" || Array.isArray(layout)) throw new Error("practice-range.json: layout must be an object.");
  const { side = DEFAULT_LAYOUT.side, width = DEFAULT_LAYOUT.width, compact = DEFAULT_LAYOUT.compact, output = DEFAULT_LAYOUT.output } = /** @type {any} */ (layout);
  if (side !== "left" && side !== "right") throw new Error('practice-range.json: layout.side must be "left" or "right".');
  if (typeof width !== "number" || !Number.isFinite(width)) throw new Error("practice-range.json: layout.width must be a number from 0.3 to 0.7.");
  if (typeof compact !== "boolean") throw new Error("practice-range.json: layout.compact must be true or false.");
  if (typeof output !== "boolean") throw new Error("practice-range.json: layout.output must be true or false.");
  return { side, width: clampWidth(width), compact, output };
}

/**
 * Save the layout and keep every other setting in the file.
 * @param {import("./types.js").Layout} layout
 * @param {{ read: () => Promise<string | null>, write: (text: string, expected: string | null) => Promise<unknown> }} io
 */
export async function saveLayoutConfig(layout, io) {
  const previous = await io.read();
  const config = parseConfig(previous);
  config.layout = { side: layout.side, width: clampWidth(layout.width), compact: layout.compact, output: layout.output };
  await io.write(JSON.stringify(config, null, 2) + "\n", previous);
}
