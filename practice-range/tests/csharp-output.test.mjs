import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCourse, taskFor } from "../mods/practice-range/courses/loader.mjs";
import { checkTask } from "../mods/practice-range/courses/service.mjs";
import { outputText } from "../mods/practice-range/output.js";

test("the receipt's actual output reaches the terminal on success and failure", async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-csharp-output-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pack = await loadCourse("course:cs-foundations");
  const { task } = taskFor(pack, "course:cs-foundations/task/save-board-sign");
  const passed = await checkTask(root, pack, task, task.solution);
  assert.equal(passed.passed, true, JSON.stringify(passed));
  assert.match(outputText(passed), /All cases passed/);
  assert.match(outputText(passed), /Your code printed:\nCorner Cafe\nLatte: 4.50\nTotal: 4.50/);

  const failed = await checkTask(root, pack, task, 'Console.WriteLine("My actual output");');
  assert.equal(failed.passed, false);
  assert.match(outputText(failed), /My actual output/);
  assert.equal(outputText(failed).split("My actual output").length - 1, 1, "Failed checks already report the captured output");
  assert.doesNotMatch(outputText(failed), /Your code printed:/);
  assert.doesNotMatch(outputText(failed), /Your code printed:\nCorner Cafe/);

  const thrown = await checkTask(root, pack, task, 'Console.WriteLine("Before error"); throw new InvalidOperationException("Stopped here");');
  assert.equal(thrown.passed, false);
  assert.match(outputText(thrown), /Stopped here/);
  assert.match(outputText(thrown), /Your code printed:\nBefore error/);
});
