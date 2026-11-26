import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand, enrollmentDirectory, checkTask } from "../mods/practice-range/courses/service.mjs";
import { loadCourse, taskFor } from "../mods/practice-range/courses/loader.mjs";

const courseId = "course:ts-foundations", moduleId = `${courseId}/module/values`, taskId = `${courseId}/task/remaining`;
async function rootFor(t) {
  const root = await mkdtemp(join(tmpdir(), "practice-course-session-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("course enrollment resumes reading and predictions without a repo, model, or practice session", async t => {
  const root = await rootFor(t);
  await assert.rejects(courseCommand(root, "status", { courseId }), /Start this course/);
  await assert.rejects(courseCommand(root, "enroll", { courseId, entryPath: "unknown" }), /entry path/);
  const run = (action, value = {}) => courseCommand(root, action, { courseId, ...value });
  await run("enroll");
  await run("open", { moduleId, step: 1 });
  await run("seen", { moduleId, step: 1 });
  let state = await run("question", { moduleId, questionId: "predict-count", choice: 1 });
  assert.equal(state.enrollment.modules[moduleId].questions["predict-count"].correct, false);
  state = await run("question", { moduleId, questionId: "predict-count", choice: 0 });
  assert.equal(state.enrollment.modules[moduleId].questions["predict-count"].correct, true);
  assert.equal(state.enrollment.modules[moduleId].questions["predict-count"].attempts, 2);
  assert.deepEqual(state.enrollment.tasks, {}, "Questions never establish independent coding evidence");
  state = await run("status");
  assert.deepEqual(state.enrollment.position, { moduleId, step: 1 });
  assert.deepEqual(state.enrollment.modules[moduleId].seen, [1]);
  await assert.rejects(run("open", { moduleId: `${courseId}/module/not-written` }), /planned/);
  assert.deepEqual((await run("status")).enrollment.position, state.enrollment.position);
  await assert.rejects(readFile(join(root, "session.json")), { code: "ENOENT" });
});

test("course fixtures aggregate into one attempt, preserve assistance, and ignore generated or duplicate saves", { timeout: 120000 }, async t => {
  const root = await rootFor(t), pack = await loadCourse(courseId);
  const { task } = taskFor(pack, taskId);
  const run = (action, value = {}) => courseCommand(root, action, { courseId, taskId, ...value });
  const sentinel = '{"existingPractice":true}\n';
  await writeFile(join(root, "session.json"), sentinel);
  await run("enroll");
  await run("open", { moduleId, step: 2 });
  let state = await run("task");
  assert.equal(state.file.startsWith(join(root, "courses")), true);
  assert.equal(state.course.lessons.find(lesson => lesson.id === moduleId).tasks.find(task => task.id === taskId).solution, null);
  state = await run("check-saved");
  assert.equal(state.enrollment.tasks[taskId].attempts, 0);
  await writeFile(state.file, task.solution);
  state = await run("check-saved");
  let progress = state.enrollment.tasks[taskId];
  assert.equal(progress.result.passed, true);
  assert.equal(progress.result.fixtures.length, 3);
  assert.equal(progress.attempts, 1);
  assert.equal(progress.independentPasses, 1);
  state = await run("check-saved");
  assert.equal(state.enrollment.tasks[taskId].attempts, 1);
  await run("reset");
  state = await run("hint");
  assert.equal(state.course.lessons.find(lesson => lesson.id === moduleId).tasks.find(task => task.id === taskId).hints.length, 1);
  await writeFile(state.file, task.solution + "\n");
  state = await run("check");
  progress = state.enrollment.tasks[taskId];
  assert.equal(progress.attempts, 2);
  assert.equal(progress.passes, 2);
  assert.equal(progress.independentPasses, 1, "A hinted pass is separate from independent success");
  assert.equal(progress.history[1].assisted, true);
  state = await run("answer");
  assert.equal(state.course.lessons.find(lesson => lesson.id === moduleId).tasks.find(task => task.id === taskId).solution, task.solution);
  await writeFile(state.file, "const broken: number = 'text';\n");
  assert.equal((await run("status")).stale, true);
  state = await run("check");
  assert.equal(state.enrollment.tasks[taskId].result.passed, false);
  await run("open", { moduleId, step: 2 });
  await assert.rejects(run("check-saved"), /no longer selected/);
  assert.equal(await readFile(join(root, "session.json"), "utf8"), sentinel);
  assert.deepEqual((await run("status")).enrollment.position, { moduleId, step: 2 });
});

test("all fixtures use the same source and a failure cannot be hidden by a passing case", async () => {
  const pack = await loadCourse(courseId), { task } = taskFor(pack, taskId);
  const sources = [];
  const result = await checkTask("unused", pack, task, "snapshot", async (_root, exercise, source) => {
    sources.push(source);
    return { passed: sources.length !== 2, kind: "result", title: "Fixture", details: [exercise.declarations] };
  });
  assert.deepEqual(sources, ["snapshot", "snapshot", "snapshot"]);
  assert.equal(result.passed, false);
  assert.match(result.details[0], /Case empty/);
});

test("damaged progress is preserved instead of silently replaced", async t => {
  const root = await rootFor(t), pack = await loadCourse(courseId);
  await courseCommand(root, "enroll", { courseId });
  const file = join(enrollmentDirectory(root, pack), "enrollment.json");
  await writeFile(file, "{broken");
  await assert.rejects(courseCommand(root, "enroll", { courseId }), /Cannot read course progress/);
  assert.equal(await readFile(file, "utf8"), "{broken");
});
