import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";
import { loadCourse, listCourses } from "../mods/practice-range/courses/loader.mjs";

const courseId = "course:docker", moduleId = `${courseId}/module/start`;

test("the Docker course is a complete reading course with no language, runner or exercises", async () => {
  const pack = await loadCourse(courseId);
  assert.equal(pack.kind, "reading");
  assert.equal(pack.languageId, undefined);
  assert.equal(pack.runner, undefined);
  assert.equal(pack.modules.length, 16);
  assert.ok(pack.modules.every(entry => entry.status === "available"));
  assert.equal(pack.lessons.length, 16);
  for (const lesson of pack.lessons) {
    assert.deepEqual(lesson.tasks, [], `${lesson.id} has no exercises`);
    assert.ok(lesson.steps.length >= 6, `${lesson.id} is a full lesson`);
    assert.ok(lesson.questions.length >= 2, `${lesson.id} asks the reader to judge something`);
    assert.ok(lesson.steps.some(step => step.kind === "independent"), `${lesson.id} has an exercise`);
    assert.ok(lesson.steps.some(step => step.kind === "walkthrough"), `${lesson.id} has a worked answer`);
    for (const [name, example] of Object.entries(lesson.examples)) {
      assert.equal(example.readOnly, true, `${lesson.id}/${name} is shown, never run`);
      assert.ok(["text", "bash", "dockerfile", "yaml"].includes(example.fence), `${lesson.id}/${name} names how to show it`);
      // Diagrams and terminal output are plain text. Keep them narrow enough not to wrap.
      for (const line of example.code.split("\n")) assert.ok(line.length <= 76, `${lesson.id}/${name}: ${line}`);
    }
    for (const question of lesson.questions) {
      assert.ok(lesson.steps.some(step => step.questions?.includes(question.id)), `${question.id} is shown in a step`);
      assert.equal(new Set(question.choices.map(choice => choice.text)).size, question.choices.length);
      assert.ok(question.choices.every(choice => choice.feedback), `${question.id} explains every answer`);
    }
  }
  const text = JSON.stringify(pack);
  // Examples must not contain anything that looks like a live credential.
  assert.doesNotMatch(text, /sk_live|eyJhbGciOi|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY/);
  // Every image an example names, other than the two review exercises, carries a version.
  for (const lesson of pack.lessons.filter(lesson => !/\/(images|capstone|secure)$/.test(lesson.id)))
    for (const [name, example] of Object.entries(lesson.examples))
      assert.doesNotMatch(example.code, /^\s*(FROM|image:)\s+[a-z./-]+(:latest)?\s*$/m, `${lesson.id}/${name} names an image without a version`);
  const summary = (await listCourses()).find(course => course.id === courseId);
  assert.deepEqual([summary.languageId, summary.reading, summary.available, summary.total], [undefined, true, 16, 16]);
});

test("the Docker course enrolls, keeps a reading position and records answers without Docker", async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-course-docker-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const run = (action, value = {}) => courseCommand(root, action, { courseId, ...value });
  let state = await run("enroll", { entryPath: "beginner" });
  assert.equal(state.course.reading, true);
  assert.equal(state.course.codeFence, "text");
  state = await run("open", { moduleId, step: 2 });
  state = await run("seen", { moduleId, step: 2 });
  state = await run("question", { moduleId, questionId: "entry-args", choice: 0 });
  assert.equal(state.enrollment.modules[moduleId].questions["entry-args"].correct, false);
  state = await run("question", { moduleId, questionId: "entry-args", choice: 1 });
  assert.equal(state.enrollment.modules[moduleId].questions["entry-args"].correct, true);
  assert.deepEqual(state.enrollment.tasks, {});
  assert.equal(state.evidence[moduleId].status, "started");
  state = await run("status");
  assert.deepEqual(state.enrollment.position, { moduleId, step: 2 });
  await assert.rejects(run("attach-repo", { path: root }), /no code/);
});
