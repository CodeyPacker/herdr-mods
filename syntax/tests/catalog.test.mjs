import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { topics, exercises, findExercise } from "../mods/syntax/catalog.js";
import { buildChecker, checkAnswer } from "../mods/syntax/languages/csharp/runner.mjs";
import { runProcess } from "../mods/syntax/process.mjs";
import { exerciseSource, checkingSource } from "../mods/syntax/languages/csharp/source.mjs";
import { filteredTopics, visibleHints, topicProgress, savedExercise } from "../mods/syntax/practice.js";

test("the catalog contains 40 exercises per topic, including eight advanced topics", () => {
  assert.equal(topics.length, 20);
  assert.equal(topics.filter(topic => topic.level === "advanced").length, 8);
  assert.equal(exercises.length, 800);
  assert.equal(new Set(exercises.map(item => item.id)).size, 800);
  for (const topic of topics) {
    assert.equal(topic.exercises.length, 40, topic.id);
    assert.equal(new Set(topic.exercises.map(item => item.solution)).size, 40, topic.id);
  }
  for (const exercise of exercises) {
    assert.equal(exercise.hints.length, 3, exercise.id);
    assert.ok(exercise.hints.every(hint => hint.length > 10), exercise.id);
    assert.ok(exercise.hints[2].includes("___"), `${exercise.id}: keep the answer separate from the skeleton hint`);
    assert.ok(exercise.checks.length && exercise.rules.length, exercise.id);
    assert.equal(exerciseSource(exercise, exercise.solution), `${exercise.solution}\n`);
    const generated = checkingSource(exercise, exercise.solution);
    assert.equal(generated.source.slice(generated.start, generated.end), exercise.solution);
  }
});

test("topic helpers preserve the chosen topic and reveal hints cumulatively", () => {
  const exercise = findExercise("loops/foreach");
  assert.deepEqual(visibleHints(exercise, 0), []);
  assert.deepEqual(visibleHints(exercise, 2), exercise.hints.slice(0, 2));
  assert.deepEqual(visibleHints(exercise, 100), exercise.hints);
  assert.equal(savedExercise("loops", { loops: "loops/foreach" }).id, "loops/foreach");
  assert.equal(savedExercise("loops", { loops: "variables/integer" }).topicId, "loops");
  assert.ok(filteredTopics("foreach").some(topic => topic.id === "loops"));
  assert.equal(filteredTopics("advanced").length, 8);
  assert.deepEqual(topicProgress({ progress: { "loops/foreach": { attempts: 3, passes: 2 } } }, "loops"), { practiced: 1, passed: 1, attempts: 3, total: 40 });
});

test("advanced checks reject a delegate field posing as an event and a hardcoded LINQ result", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-advanced-negative-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checker = await buildChecker(root);
  const event = findExercise("delegates/event");
  assert.equal((await checkAnswer(root, event, event.solution.replace("event EventHandler", "EventHandler"), checker)).kind, "syntax");
  assert.equal((await checkAnswer(root, findExercise("linq/where"), "int[] values = { 1, 2, 3, 4 }; var result = new[] { 2, 4 };", checker)).kind, "syntax");
  const cancellation = findExercise("async/throw-canceled");
  assert.equal((await checkAnswer(root, cancellation, cancellation.solution.replace("token.ThrowIfCancellationRequested();", "default(System.Threading.CancellationToken).ThrowIfCancellationRequested();"), checker)).kind, "result");
});

test("all 800 reference answers compile, use the requested syntax, and pass execution checks", { timeout: 600000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-catalog-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checker = await buildChecker(root);
  const failures = [];
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < exercises.length) {
      const exercise = exercises[next++];
      const result = await checkAnswer(root, exercise, exercise.solution, checker);
      if (!result.passed) failures.push(`${exercise.id}: ${JSON.stringify(result)}`);
    }
  }));
  assert.deepEqual(failures, []);
});

test("syntax, behavior, compiler errors, and infinite loops have different feedback", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-negative-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checker = await buildChecker(root);
  const exercise = findExercise("loops/for");
  assert.equal((await checkAnswer(root, exercise, "// for (int i = 0; i < 5; i++) {}\nint total = 10;", checker)).kind, "syntax");
  assert.equal((await checkAnswer(root, exercise, 'string fake = "for (int i = 0; i < 5; i++) {}";\nint total = 10;', checker)).kind, "syntax");
  assert.equal((await checkAnswer(root, exercise, "int total = 0; for (int i = 0; i < 3; i++) total += i;", checker)).kind, "result");
  assert.equal((await checkAnswer(root, exercise, "int total = ;", checker)).kind, "compile");
  assert.equal((await checkAnswer(root, exercise, "int total = 0; for (;;) { total++; }", checker, { timeout: 200 })).kind, "runtime");
  assert.equal((await checkAnswer(root, exercise, "int total = 0; for (var n = 0; n != 5; ++n) { total = total + n; }", checker)).passed, true);
  const noisy = await runProcess(process.execPath, ["-e", 'while (true) process.stdout.write("x".repeat(1000))'], { maxOutput: 2000 });
  assert.match(noisy.problem, /too much output/);
});
