import test from "node:test";
import assert from "node:assert/strict";
import { learnerOf, parseKnown, listText, DEFAULT_KNOWN, likeKnownQuestion } from "../mods/tutor/learner.js";
import { csharp } from "../mods/tutor/lang/csharp.js";
import { typescript } from "../mods/tutor/lang/typescript.js";
import { outlinePrompt, modulePrompt, hintPrompt, framePrompt } from "../mods/tutor/prompts.js";

test("parseKnown splits on commas, semicolons and new lines", () => {
  assert.deepEqual(parseKnown("TypeScript, some SQL;Go\n\n"), ["TypeScript", "some SQL", "Go"]);
  assert.deepEqual(parseKnown("  "), []);
  assert.equal(listText(["a", "b", "c"]), "a, b and c");
});

test("courses from before the setting keep the TypeScript learner", () => {
  const me = learnerOf({ name: "old" }, csharp);
  assert.deepEqual(me.known, DEFAULT_KNOWN);
  assert.equal(me.compare, "TypeScript");
  assert.match(me.who, /knows TypeScript and JavaScript and is new to C#/);
});

test("lessons compare to the first language, unless the learner knows the course's own", () => {
  assert.equal(learnerOf({ known: ["C#", "Python"] }, csharp).compare, null, "knows the course's own language");
  assert.equal(learnerOf({ known: ["Python", "Go"] }, csharp).compare, "Python");
  assert.equal(learnerOf({ known: ["TypeScript", "JavaScript"] }, typescript).compare, null);
  assert.equal(learnerOf({ known: ["C#"] }, typescript).compare, "C#");
  assert.equal(learnerOf({ known: ["some C#", "Go"] }, csharp).compare, null);
  const self = learnerOf({ known: ["C#"] }, csharp);
  assert.equal(self.compare, null);
  assert.match(self.who, /already knows C#/);
  const nothing = learnerOf({ known: [] }, csharp);
  assert.equal(nothing.compare, null);
  assert.match(nothing.who, /new to programming/);
  assert.equal(likeKnownQuestion(null), null);
  assert.match(likeKnownQuestion("Go"), /closest Go version/);
});

test("prompts follow the learner", () => {
  const go = learnerOf({ known: ["Go"] }, csharp);
  const course = { name: "r", about: "", commit: "abc", modules: [{ title: "T", summary: "S" }], known: ["Go"] };
  const all = [outlinePrompt({ name: "r", commit: "abc", count: 3 }, csharp, go),
    modulePrompt(course, { title: "T", summary: "S" }, 1, csharp, go), framePrompt(course, { title: "T" }, 1, csharp, go),
    hintPrompt({ title: "x", prompt: "p", concept: "c", expected: "1" }, "src", null, 1, csharp, go)].join("\n");
  assert.doesNotMatch(all, /TypeScript/);
  assert.match(all, /knows Go/);
  assert.match(all, /how Go would do it/);
  const none = learnerOf({ known: [] }, csharp);
  const plain = modulePrompt(course, { title: "T", summary: "S" }, 1, csharp, none);
  assert.doesNotMatch(plain, /undefined|null/);
  assert.match(plain, /what a learner would plausibly guess/);
});
