import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";
import { loadCourse, listCourses, validatePack } from "../mods/practice-range/courses/loader.mjs";

const courseId = "course:api-design", moduleId = `${courseId}/module/methods`;

test("the API design course is a complete reading course with no language, runner or exercises", async () => {
  const pack = await loadCourse(courseId);
  assert.equal(pack.kind, "reading");
  assert.equal(pack.languageId, undefined);
  assert.equal(pack.runner, undefined);
  assert.equal(pack.modules.length, 15);
  assert.ok(pack.modules.every(entry => entry.status === "available"));
  assert.equal(pack.lessons.length, 15);
  for (const lesson of pack.lessons) {
    assert.deepEqual(lesson.tasks, [], `${lesson.id} has no exercises`);
    assert.ok(lesson.steps.length >= 6, `${lesson.id} is a full lesson`);
    assert.ok(lesson.questions.length >= 2, `${lesson.id} asks the reader to judge something`);
    assert.ok(lesson.steps.some(step => step.kind === "independent"), `${lesson.id} has a design exercise`);
    assert.ok(lesson.steps.some(step => step.kind === "walkthrough"), `${lesson.id} has a worked answer`);
    for (const [name, example] of Object.entries(lesson.examples)) {
      assert.equal(example.readOnly, true, `${lesson.id}/${name} is shown, never run`);
      assert.ok(["text", "http", "json", "yaml"].includes(example.fence), `${lesson.id}/${name} names how to show it`);
      // Diagrams are plain text so they need no renderer. Keep them narrow enough not to wrap.
      for (const line of example.code.split("\n")) assert.ok(line.length <= 76, `${lesson.id}/${name}: ${line}`);
    }
    for (const question of lesson.questions) {
      assert.ok(lesson.steps.some(step => step.questions?.includes(question.id)), `${question.id} is shown in a step`);
      assert.equal(new Set(question.choices.map(choice => choice.text)).size, question.choices.length);
    }
  }
  // Examples must not contain anything that looks like a live credential.
  assert.doesNotMatch(JSON.stringify(pack), /sk_live|eyJhbGciOi|AKIA[0-9A-Z]{16}/);
  const summary = (await listCourses()).find(course => course.id === courseId);
  assert.deepEqual([summary.languageId, summary.reading, summary.available, summary.total], [undefined, true, 15, 15]);
});

test("a reading course may not carry a language, exercises or runnable examples", async () => {
  const original = await loadCourse(courseId);
  const invalid = (mutate, pattern) => {
    const pack = structuredClone(original); mutate(pack);
    assert.throws(() => validatePack(pack), pattern);
  };
  invalid(pack => pack.languageId = "sql", /names no language or runner/);
  invalid(pack => Object.assign(pack.lessons[0].examples.boundary, { readOnly: false, stdout: ["ok"] }), /no exercises or runnable examples/);
  invalid(pack => pack.lessons[0].tasks.push({ id: `${pack.id}/task/x` }), /no exercises or runnable examples/);
  invalid(pack => pack.readiness = [{ id: "R1" }], /no readiness checks/);
  invalid(pack => pack.lessons[0].steps[0].example = "missing", /step example/);
});

test("a reading course enrolls, keeps a reading position and records answers without any tools", async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-course-reading-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const run = (action, value = {}) => courseCommand(root, action, { courseId, ...value });
  await assert.rejects(run("enroll", { entryPath: "experienced" }), /entry path/);
  let state = await run("enroll", { entryPath: "beginner" });
  assert.equal(state.course.reading, true);
  assert.equal(state.course.codeFence, "text");
  assert.deepEqual(state.course.readiness, []);
  state = await run("open", { moduleId, step: 3 });
  state = await run("seen", { moduleId, step: 3 });
  state = await run("question", { moduleId, questionId: "retry", choice: 0 });
  assert.equal(state.enrollment.modules[moduleId].questions.retry.correct, false);
  state = await run("question", { moduleId, questionId: "retry", choice: 2 });
  assert.equal(state.enrollment.modules[moduleId].questions.retry.correct, true);
  assert.deepEqual(state.enrollment.tasks, {});
  assert.equal(state.evidence[moduleId].status, "started");
  assert.equal(state.reviewReady, 0, "There are no exercises to review");
  state = await run("status");
  assert.deepEqual(state.enrollment.position, { moduleId, step: 3 });
  await assert.rejects(run("attach-repo", { path: root }), /no code/);
});
