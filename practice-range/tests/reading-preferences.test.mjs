import { test } from "node:test";
import assert from "node:assert/strict";
import { READING_DEFAULTS, readingPreferences, readingWidth } from "../mods/practice-range/courses/reading-preferences.js";

test("missing and malformed preferences keep reading usable", () => {
  for (const value of [null, undefined, "bad", [], { size: NaN, lineHeight: Infinity, margins: "-5", font: "bad\nfont" }])
    assert.deepEqual(readingPreferences(value), READING_DEFAULTS);
});

test("preserves installed font names, exact line spacing, and negative margins", () => {
  assert.deepEqual(readingPreferences({ font: " Avenir Next ", size: 18, lineHeight: 2.15, margins: -5 }),
    { font: "Avenir Next", size: 18, lineHeight: 2.15, margins: -5 });
  assert.equal(readingWidth(680, -5), 748);
  assert.equal(readingWidth(680, 5), 612);
});

test("bounds saved settings and avoids accumulating fractional step errors", () => {
  assert.deepEqual(readingPreferences({ size: 900, lineHeight: 0, margins: -500 }),
    { font: "", size: 24, lineHeight: 1.2, margins: -10 });
  assert.equal(readingPreferences({ lineHeight: 2.1 + 0.05 }).lineHeight, 2.15);
  const prefs = readingPreferences(READING_DEFAULTS);
  prefs.size = 24;
  assert.equal(READING_DEFAULTS.size, 13);
});
