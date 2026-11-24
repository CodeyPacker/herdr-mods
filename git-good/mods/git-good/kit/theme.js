// The kit: the look and the building blocks every mod in this repo shares.
//
// This folder at the repo root is the one place to edit. A mod can only import from its own
// folder, so `node scripts/sync-kit.mjs` copies it into each mod as `mods/<name>/kit/`, and
// mods import from "./kit/...". Never edit a copy: the next sync overwrites it.
//
// This file: the theme's colors and the sizes the other kit files draw with.
import { theme, layout, props, shared } from "herdr";

/** @typedef {import("gpui-kit").Color} Color */
/** @typedef {Record<string, Color>} Theme */

/** The fills that follow the terminals' opacity. Popover (menus, cards over content) stays solid. */
const SEE_THROUGH = ["background", "canvas", "chrome", "surface", "raised", "hover", "selected", "input", "selection"];

/**
 * The app's theme colors by name, typed as colors the builders accept. In a tab over a background
 * picture with see-through terminals (seeThroughOpacity), the fills come at the terminals'
 * opacity, so a mod's rows, inputs and buttons match them. When the Wallpaper mod's borders are
 * None (bordersHidden), `border` is clear, so outlines drawn in it go away, and with Light or Dark
 * (chosenBorder) it is that color. Dialogs keep the solid colors and their borders.
 * @returns {Theme}
 */
export function colors() {
  const t = /** @type {Theme} */ (theme());
  const opacity = props()?.overlay === undefined ? seeThroughOpacity() : null;
  const hide = bordersHidden();
  const edge = chosenBorder();
  if (opacity === null && !hide && !edge) return t;
  const faded = { ...t };
  if (opacity !== null) {
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, "0");
    for (const key of SEE_THROUGH) {
      const c = String(t[key] ?? "");
      if (/^#[0-9a-f]{6}$/i.test(c)) faded[key] = /** @type {Color} */ (c + alpha);
    }
  }
  if (hide) faded.border = /** @type {Color} */ ("#00000000");
  else if (edge) faded.border = edge;
  return faded;
}

/**
 * The border color the Wallpaper mod's Light or Dark chose for the shown layout ({ borders,
 * borderColor } in "backgrounds.seeThrough"), or null for Theme, None, or a dialog, which keeps
 * the theme's. @returns {Color | null}
 */
export function chosenBorder() {
  if (props()?.overlay !== undefined) return null;
  const s = /** @type {any} */ (shared("backgrounds.seeThrough"));
  if (!s || typeof s !== "object" || s.layout !== shared("layout") || (s.borders !== "light" && s.borders !== "dark")) return null;
  return /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(String(s.borderColor ?? "")) ? /** @type {Color} */ (s.borderColor) : null;
}

/**
 * Whether the Wallpaper mod's borders are None on the shown layout: it records
 * { layout, opacity, borders: "none" } in shared state ("backgrounds.seeThrough"). Only for a mod
 * in a pane, tab or bar. A dialog floats over everything and keeps its borders.
 * @returns {boolean}
 */
export function bordersHidden() {
  if (props()?.overlay !== undefined) return false;
  const s = /** @type {any} */ (shared("backgrounds.seeThrough"));
  return Boolean(s && typeof s === "object" && s.layout === shared("layout") && s.borders === "none");
}

/**
 * The panes' opacity when the background picker made them see-through on the shown layout: it
 * records { layout, opacity } in shared state ("backgrounds.seeThrough"), clears the terminals and
 * gives the pane frame the theme's background at that opacity. Null otherwise, so other setups
 * look as they always have.
 * @returns {number | null}
 */
export function seeThroughOpacity() {
  const s = /** @type {any} */ (shared("backgrounds.seeThrough"));
  if (!s || typeof s !== "object" || s.layout !== shared("layout")) return null;
  const root = /** @type {any} */ (layout());
  if (!root || typeof root.background !== "object" || typeof root.background?.image !== "string") return null;
  const o = Number(s.opacity);
  return Number.isFinite(o) && o < 1 ? Math.max(0, o) : null;
}

/**
 * A mod's own background in a tab: `color` as it is, or clear when the panes are see-through,
 * because the pane frame under the mod then draws the theme's background at the panes' opacity.
 * @param {Color} color the mod's usual background @returns {Color}
 */
export function paneBackground(color) {
  return seeThroughOpacity() === null ? color : /** @type {Color} */ ("#00000000");
}

/**
 * A bar or panel's fill around the tabs: `color` as it is, or, when the layout shows its
 * background picture through the terminals, `color` at the terminals' opacity.
 * @param {Color} color @returns {Color}
 */
export function seeThroughFill(color) {
  const opacity = seeThroughOpacity();
  if (opacity === null || !/^#[0-9a-f]{6}$/i.test(String(color))) return color;
  return /** @type {Color} */ (`${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`);
}

/**
 * The border that shows where the keyboard is: a text box you're typing in, the pane or card that
 * has the keys. The text color at 20%, a little lighter than `border`, so it shows without pulling
 * the eye the way the accent does. Selection and "on" states keep the accent.
 * @param {Theme} t @returns {Color}
 */
export function focusBorder(t) {
  // With the Wallpaper mod's borders None, the outline is clear too, so no border is left. `border`
  // is clear then: colors() makes it so, and so does the layout on a copy of Herdr's own.
  if (bordersHidden() || /^#[0-9a-f]{6}00$/i.test(String(t.border ?? ""))) return /** @type {Color} */ ("#00000000");
  const c = String(t.foreground ?? "");
  return /** @type {Color} */ (/^#[0-9a-f]{6}$/i.test(c) ? `${c}33` : t.input);
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
