import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startTopic, topicList } from "../mods/practice-range/start-topic.js";

const ready = { completed: true, enabled: ["csharp", "sql"] };

test("another mod can open Practice Range at a topic", () => {
  assert.deepEqual(startTopic({ languageId: "csharp", topicId: "linq" }, ready), { languageId: "csharp", topicId: "linq" });
  assert.deepEqual(startTopic({ languageId: "sql", topicId: "joins" }, ready), { languageId: "sql", topicId: "joins" });
});

test("anything off opens Practice Range as usual", () => {
  assert.equal(startTopic(undefined, ready), null);
  assert.equal(startTopic("linq", ready), null);
  assert.equal(startTopic({ languageId: "csharp", topicId: "no-such-topic" }, ready), null);
  assert.equal(startTopic({ languageId: "typescript", topicId: "generics" }, ready), null, "not enabled yet");
  assert.equal(startTopic({ languageId: "go", topicId: "loops" }, { completed: true, enabled: ["go"] }), null);
  assert.equal(startTopic({ languageId: "csharp", topicId: "linq" }, { completed: false, enabled: ["csharp"] }), null);
});

test("topics.mjs lists every language and topic", () => {
  const out = JSON.parse(execFileSync("node", [fileURLToPath(new URL("../mods/practice-range/topics.mjs", import.meta.url))], { encoding: "utf8" }));
  assert.equal(out.version, 1);
  assert.deepEqual(out.languages.map(l => l.id), ["csharp", "typescript", "sql"]);
  assert.deepEqual(out, { version: 1, languages: topicList() });
  for (const l of out.languages) {
    assert.equal(l.topics.length, 20);
    for (const t of l.topics) assert.ok(t.id && t.title, `${l.id} topic`);
  }
});
