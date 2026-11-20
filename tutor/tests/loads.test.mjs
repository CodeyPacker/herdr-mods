import test from "node:test";
import assert from "node:assert/strict";

// Every import in the view resolves: a renamed or missing export fails here, not in Herdr.
test("main.js and every view load", async () => {
  const main = await import("../mods/tutor/main.js");
  assert.equal(typeof main.default, "function");
});
