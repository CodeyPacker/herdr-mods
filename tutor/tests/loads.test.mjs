import test from "node:test";
import assert from "node:assert/strict";
import { csharp } from "../mods/tutor/lang/csharp.js";
import { typescript } from "../mods/tutor/lang/typescript.js";

// Every import in the view resolves: a renamed or missing export fails here, not in Herdr.
test("main.js and every view load", async () => {
  const main = await import("../mods/tutor/main.js");
  assert.equal(typeof main.default, "function");
});

// The view's small helpers, on an instance that was never drawn.
test("the view's agent and learner helpers follow settings and the course", async () => {
  const Tutor = (await import("../mods/tutor/main.js")).default;
  const v = new Tutor();
  v.settings = { editor: "neovim", agent: "codex", known: ["Go"] };
  assert.equal(v.newSession("/repo").agent, "codex");
  assert.equal(v.agentName(), "Codex");
  v.setup = { known: null };
  assert.deepEqual(v.setupKnown(), ["Go"]);
  v.course = { known: ["Python"] }; v.lang = csharp;
  assert.equal(v.me().compare, "Python");
  v.course = { known: ["TypeScript"] }; v.lang = typescript;
  assert.equal(v.me().compare, null);
});
