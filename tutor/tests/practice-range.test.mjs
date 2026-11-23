import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanMatches } from "../mods/tutor/validate.js";
import { topicsFor, practiceRangeTopics, openPracticeRange } from "../mods/tutor/practice-range.js";
import { writeMatches } from "../mods/tutor/build.js";
import { csharp } from "../mods/tutor/lang/csharp.js";

const course = { modules: [{ id: "01-setup", title: "Setup", summary: "s" }, { id: "02-linq", title: "LINQ", summary: "s" }, { id: "03-di", title: "DI", summary: "s" }] };
const topics = [{ id: "linq", title: "LINQ" }, { id: "generics", title: "Generics" }];

test("a pick that is not a Practice Range topic is thrown out", () => {
  assert.deepEqual(cleanMatches({ matches: { "01-setup": null, "02-linq": "linq", "03-di": "dependency-injection", "99-x": "linq" } }, course, topics),
    { "01-setup": null, "02-linq": "linq", "03-di": null });
  assert.deepEqual(cleanMatches(null, course, topics), { "01-setup": null, "02-linq": null, "03-di": null });
});

test("writeMatches asks once, fixes a reply without matches, and keeps only real topics", async () => {
  const prompts = [];
  const replies = ['{"oops": 1}', '```json\n{"matches": {"02-linq": "linq", "03-di": "di"}}\n```'];
  const io = { ask: async p => { prompts.push(p); return replies.shift(); }, say: () => {} };
  const out = await writeMatches(io, course, topics, csharp);
  assert.equal(prompts.length, 2);
  assert.match(prompts[0], /- linq: LINQ/);
  assert.match(prompts[0], /- 02-linq: LINQ/);
  assert.deepEqual(out.matches, { "01-setup": null, "02-linq": "linq", "03-di": null });
  assert.equal(out.language, "csharp");
});

test("topics come from Practice Range's topics.mjs, and nothing without it", async () => {
  assert.deepEqual(topicsFor({ languages: [{ id: "csharp", topics }] }, "csharp"), topics);
  assert.equal(topicsFor({ languages: [{ id: "csharp", topics }] }, "go"), null);
  assert.equal(topicsFor({}, "csharp"), null);
  const home = await mkdtemp(join(tmpdir(), "tutor-range-"));
  globalThis.herdrStub = { appHome: home };
  assert.equal(await practiceRangeTopics("csharp"), null, "not installed");
  await mkdir(join(home, "mods/practice-range"), { recursive: true });
  await writeFile(join(home, "mods/practice-range/topics.mjs"), "");
  globalThis.herdrStub = { appHome: home, exec: async () => ({ code: 0, stdout: JSON.stringify({ version: 1, languages: [{ id: "csharp", topics }] }) }) };
  assert.deepEqual(await practiceRangeTopics("csharp"), topics);
  globalThis.herdrStub = { appHome: home, exec: async () => ({ code: 1, stdout: "" }) };
  assert.equal(await practiceRangeTopics("csharp"), null, "node failed");
  const runs = [];
  globalThis.herdrStub = { run: (...a) => runs.push(a) };
  openPracticeRange("csharp", "linq");
  assert.deepEqual(runs, [["tab.new", { name: "Practice Range", mod: "practice-range", props: { practiceTab: true, startTopic: { languageId: "csharp", topicId: "linq" } } }]]);
});
