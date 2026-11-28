export const READING_KEY = "practice-range.reading";
export const READING_DEFAULTS = Object.freeze({ font: "", size: 13, lineHeight: 1.6, margins: 0 });

/** Keep saved reading preferences usable across versions and computers. @param {unknown} value */
export function readingPreferences(value) {
  const saved = /** @type {Record<string, unknown>} */ (value && typeof value === "object" ? value : {});
  /** @param {"size" | "lineHeight" | "margins"} key @param {number} min @param {number} max */
  const number = (key, min, max) => typeof saved[key] === "number" && Number.isFinite(saved[key])
    ? Math.round(Math.max(min, Math.min(max, saved[key])) * 100) / 100 : READING_DEFAULTS[key];
  return {
    font: typeof saved.font === "string" && saved.font.length <= 200 && !/[\x00-\x1f]/.test(saved.font) ? saved.font.trim() : "",
    size: number("size", 10, 24),
    lineHeight: number("lineHeight", 1.2, 2.8),
    margins: number("margins", -10, 20),
  };
}

/** Margin adjustments are relative to the normal reading column. @param {number} width @param {number} margins */
export const readingWidth = (width, margins) => Math.round(width * (1 - 2 * margins / 100));
