import { test } from "node:test";
import assert from "node:assert/strict";
import { languages, defaultLanguage, findLanguage } from "../mods/syntax/languages/index.js";
import { loadLanguageRunner } from "../mods/syntax/languages/runner.mjs";
import { catalogFor } from "../mods/syntax/catalog.js";
import { filteredTopics, savedExercise, topicProgress } from "../mods/syntax/practice.js";

// Exercise the public boundary between the base mod and a bundled pack.
test("the bundled C# pack exposes metadata and a separately loaded runner", async () => {
  assert.deepEqual(languages.map(language => language.id), ["csharp", "typescript"]);
  assert.equal(defaultLanguage.name, "C#");
  assert.equal(defaultLanguage.answerFile, "Exercise.cs");
  assert.equal(defaultLanguage.runtime, ".NET SDK 8 or newer");
  assert.equal(findLanguage("csharp"), defaultLanguage);
  assert.throws(() => findLanguage("../../outside"), /Language pack is not installed/);
  await assert.rejects(loadLanguageRunner("python"), /Language pack is not installed/);
  const runner = await loadLanguageRunner("csharp");
  for (const method of ["environment", "createAnswer", "migrateAnswer", "prepareWorkspace", "check"]) {
    assert.equal(typeof runner[method], "function", method);
  }
  assert.equal(runner.createAnswer(defaultLanguage.exercises[0]), "// Write your answer here.\n");
  assert.equal(runner.migrateAnswer(defaultLanguage.exercises[0], "int count = 12;"), null);
});

test("the shared catalog uses the supplied pack without mixing its exercises with C#", () => {
  const exercise = { id: "variables/constant", topicId: "variables", title: "Constant", prompt: "Declare a constant", solution: "const count = 12;", hints: [] };
  const topic = { id: "variables", title: "Variables", description: "Declarations", exercises: [exercise] };
  const catalog = catalogFor({ ...defaultLanguage, id: "test", topics: [topic], exercises: [exercise] });
  assert.equal(catalog.findExercise(exercise.id), exercise);
  assert.deepEqual(catalog.topicExercises("variables"), [exercise]);
  assert.throws(() => catalog.findExercise("variables/integer"), /Unknown exercise/);
  assert.deepEqual(filteredTopics("constant", catalog), [topic]);
  assert.equal(savedExercise("variables", { variables: "variables/integer" }, catalog), exercise);
  assert.deepEqual(topicProgress(null, "variables", catalog), { practiced: 0, passed: 0, attempts: 0, total: 1 });
});

test("the bundled TypeScript pack registers UI-safe metadata and its own runner", async () => {
  const typescript = findLanguage("typescript");
  assert.equal(typescript.name, "TypeScript");
  assert.equal(typescript.answerFile, "Exercise.ts");
  assert.equal(typescript.fileExtension, ".ts");
  assert.equal(typescript.codeFence, "typescript");
  assert.equal(typescript.dataDirectory, "languages/typescript");
  assert.equal(defaultLanguage.dataDirectory, ".", "C# keeps its original practice paths");
  assert.match(typescript.runtime, /TypeScript compiler 6\.0\.3/);
  assert.match(typescript.setupInstructions, /npm ci/);
  assert.equal(typescript.topics.length, 20);
  assert.equal(typescript.exercises.length, 800);
  const runner = await loadLanguageRunner("typescript");
  for (const method of ["environment", "createAnswer", "migrateAnswer", "prepareWorkspace", "check"]) {
    assert.equal(typeof runner[method], "function", method);
  }
  const first = typescript.exercises[0];
  assert.equal(runner.createAnswer(first), "// Write your answer here.\n");
  assert.equal(runner.migrateAnswer(first, "const count = 12;\n"), null, "TypeScript answers are never rewritten");
  assert.match((await runner.environment()).version, /^TypeScript 6\.0\.3$/);
});

test("the UI imports neither compiler nor Node modules through pack metadata", async () => {
  const { readFile, readdir } = await import("node:fs/promises");
  const pack = new URL("../mods/syntax/languages/typescript/", import.meta.url);
  const files = ["index.js", "catalog.js", ...(await readdir(new URL("content/", pack))).map(name => `content/${name}`)];
  for (const file of files) {
    const text = await readFile(new URL(file, pack), "utf8");
    const imports = [...text.matchAll(/^import .* from "([^"]+)";$/gm)].map(match => match[1]);
    assert.ok(imports.every(path => path.startsWith("./") || path.startsWith("../")), `${file}: ${imports}`);
    assert.ok(imports.every(path => path.endsWith(".js")), `${file} must not import .mjs runner code: ${imports}`);
  }
});
