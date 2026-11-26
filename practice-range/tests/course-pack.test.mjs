import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCourse, listCourses, validatePack, taskFor, lessonFor } from "../mods/practice-range/courses/loader.mjs";

test("the bundled preview distinguishes written lessons from the planned course", async () => {
  const pack = await loadCourse("course:ts-foundations");
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.preview, true);
  assert.equal(pack.modules.length, 18);
  assert.equal(pack.lessons.length, 2);
  assert.equal(taskFor(pack, "course:ts-foundations/task/remaining").task.fixtures.length, 3);
  assert.match(lessonFor(pack, "course:ts-foundations/module/values").examples.board.code, /console.log/);
  assert.throws(() => lessonFor(pack, "course:ts-foundations/module/save"), /planned/);
  assert.deepEqual((await listCourses()).map(course => [course.available, course.total, course.preview]), [[2, 18, true]]);
  await assert.rejects(loadCourse("../../other"), /not installed/);
});

test("course validation rejects broken prerequisites, question answers, and exercise references", async () => {
  const original = await loadCourse("course:ts-foundations");
  const invalid = (mutate, pattern) => {
    const pack = structuredClone(original); mutate(pack);
    assert.throws(() => validatePack(pack), pattern);
  };
  invalid(pack => pack.modules[0].prerequisites.push(pack.modules[1].id), /cyclic/);
  invalid(pack => pack.modules[0].prerequisites.push("missing"), /missing prerequisite/);
  invalid(pack => pack.lessons[0].questions[0].answer = 99, /answer index/);
  invalid(pack => pack.lessons[0].steps[0].task = "missing", /step task/);
  invalid(pack => pack.lessons[0].tasks[0].fixtures = [], /empty fixture/);
  invalid(pack => pack.modules[0].status = "available", /availability disagree/);
  invalid(pack => pack.lessons[1].tasks[0].id = pack.lessons[0].tasks[0].id, /task identity/);
  invalid(pack => pack.runner.registeredLanguage = "untrusted-module.mjs", /registered language/);
  invalid(pack => pack.schemaVersion = 2, /unsupported schema/);
  invalid(pack => pack.lessons[0].tasks[0].id = `${pack.id}/task/..`, /task identity/);
  invalid(pack => pack.preview = false, /labeled previews/);
});
