import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand, enrollmentDirectory } from "../mods/practice-range/courses/service.mjs";
import { loadCourse } from "../mods/practice-range/courses/loader.mjs";
import { canMigrate, migrateState } from "../mods/practice-range/courses/migrate.mjs";

const courseId = "course:ts-foundations", oldVersion = "0.1.0-preview.1", moduleId = `${courseId}/module/values`;
const taskId = `${courseId}/task/remaining`, hinted = `${courseId}/task/shelf-label`;

test("an enrollment on the previous version updates explicitly and keeps reading, answers and results", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-course-migrate-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const old = await loadCourse(courseId, oldVersion), latest = await loadCourse(courseId);
  assert.notEqual(latest.contentVersion, oldVersion);
  const run = (action, value = {}) => courseCommand(root, action, { courseId, contentVersion: oldVersion, ...value });
  await run("enroll");
  await run("open", { moduleId, step: 1 });
  await run("seen", { moduleId, step: 1 });
  await run("question", { moduleId, questionId: "predict-count", choice: 0 });
  let state = await run("task", { taskId });
  await writeFile(state.file, old.lessons.find(lesson => lesson.id === moduleId).tasks.find(task => task.id === taskId).solution);
  state = await run("check", { taskId });
  assert.equal(state.enrollment.tasks[taskId].independentPasses, 1);
  await run("task", { taskId: hinted });
  state = await run("hint", { taskId: hinted });
  const oldDirectory = enrollmentDirectory(root, old), before = await readFile(join(oldDirectory, "enrollment.json"), "utf8");
  assert.deepEqual(state.update, { to: latest.contentVersion, compatible: true, started: false, newTasks: 8 });
  await assert.rejects(run("update-version", { to: "9.9.9" }), /not installed/);
  const result = await run("update-version", { to: latest.contentVersion });
  assert.deepEqual(result.migrated, { courseId, contentVersion: latest.contentVersion });
  assert.equal(await readFile(join(oldDirectory, "enrollment.json"), "utf8"), before, "The earlier enrollment is unchanged");
  const next = await courseCommand(root, "status", { courseId });
  assert.equal(next.course.contentVersion, latest.contentVersion, "The update selects the new version");
  assert.equal(next.update, null);
  assert.deepEqual(next.enrollment.tasks[taskId], JSON.parse(before).tasks[taskId]);
  assert.equal(next.enrollment.tasks[hinted].hintCount, 1, "Assistance carries over");
  assert.deepEqual(next.enrollment.modules[moduleId].seen, [1]);
  assert.equal(next.enrollment.modules[moduleId].questions["predict-count"].correct, true);
  assert.equal(next.enrollment.activeTask, hinted);
  assert.equal(await readFile(next.file.replace("shelf-label", "remaining"), "utf8"), old.lessons.find(lesson => lesson.id === moduleId).tasks.find(task => task.id === taskId).solution);
  assert.equal(next.evidence[moduleId].independent, 1);
  assert.equal(JSON.parse(await readFile(join(enrollmentDirectory(root, latest), "migration.json"), "utf8")).from, oldVersion);
  await assert.rejects(run("update-version", { to: latest.contentVersion }), /already started/);
  assert.equal((await run("status")).update.started, true);
});

test("migration maps declared replacements, retires unmatched work and never infers credit", () => {
  const lesson = (id, tasks, questions = []) => ({ id, steps: [{}, {}], tasks: tasks.map(id => ({ id })), questions });
  const question = { id: "q", answer: 0, choices: [{}, {}] };
  const from = { id: "c", contentVersion: "1.0.0", lessons: [lesson("m", ["a", "b", "gone"], [question])] };
  const to = { id: "c", contentVersion: "2.0.0", compatibility: { fromVersions: ["1.0.0"], replacements: [{ from: "b", to: "b2", keepCompletion: false }] },
    lessons: [{ ...lesson("m", ["a", "b2", "new"]), steps: [{}] }] };
  const progress = (passes) => ({ attempts: 1, passes, independentPasses: passes, hintCount: 0, history: [{ passed: passes > 0 }] });
  const state = { version: 1, courseId: "c", contentVersion: "1.0.0", entryPath: "beginner", review: null, activeTask: "gone",
    position: { moduleId: "m", step: 1 }, modules: { m: { seen: [0, 1], questions: { q: { choice: 0, correct: true } } } },
    tasks: { a: progress(1), b: progress(1), gone: progress(1) } };
  assert.equal(canMigrate(from, to), true);
  assert.equal(canMigrate(from, { ...to, compatibility: { fromVersions: [] } }), false);
  const next = migrateState(state, from, to, 5);
  assert.deepEqual(next.tasks.a, state.tasks.a);
  assert.deepEqual(next.tasks.b2, { ...state.tasks.b, passes: 0, independentPasses: 0, result: null, checkedHash: null, retake: { from: "b", at: 5 } });
  assert.equal(next.tasks.new, undefined, "New exercises start with no evidence");
  assert.deepEqual(next.retired["1.0.0"].tasks, { gone: state.tasks.gone });
  assert.deepEqual(next.modules.m.seen, [0], "Reading positions beyond the new lesson are dropped");
  assert.deepEqual(next.modules.m.questions, {}, "Removed questions are not carried as results");
  assert.equal(next.retired["1.0.0"].modules.m, state.modules.m);
  assert.equal(next.position, null); assert.equal(next.activeTask, null);
  assert.throws(() => migrateState({ ...state, review: { id: "r" } }, from, to), /review/);
});

test("readiness checks record their own result without moving the lesson or counting as module evidence", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-course-readiness-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pack = await loadCourse(courseId), r1 = pack.readiness[0].task;
  assert.deepEqual(pack.readiness.map(group => group.id), ["R1", "R2", "R3", "R4"]);
  await courseCommand(root, "enroll", { courseId, entryPath: "experienced" });
  let state = await courseCommand(root, "task", { courseId, taskId: r1.id });
  assert.equal(state.enrollment.position, null);
  assert.equal(state.course.readiness[0].task.solution, null, "The reference stays hidden until revealed");
  await writeFile(state.file, r1.solution);
  state = await courseCommand(root, "check", { courseId, taskId: r1.id });
  assert.equal(state.enrollment.tasks[r1.id].independentPasses, 1);
  assert.ok(pack.readiness[0].modules.every(id => state.evidence[id].status === "new"), "A readiness pass does not imply module passes");
  assert.equal(state.reviewReady, 0);
  // Project checkpoints are lesson tasks, listed in order with the final audit last.
  assert.deepEqual(state.course.project.checkpoints.map(checkpoint => checkpoint.taskId.split("/").at(-1)),
    ["project-count", "project-group", "project-test-edit", "project-local-reader", "report-audit"]);
  const group = pack.lessons.find(lesson => lesson.id === `${courseId}/module/collections`).tasks.find(task => task.id.endsWith("project-group"));
  state = await courseCommand(root, "task", { courseId, taskId: group.id });
  assert.equal(state.enrollment.position.moduleId, `${courseId}/module/collections`);
  await writeFile(state.file, group.solution);
  state = await courseCommand(root, "check", { courseId, taskId: group.id });
  assert.equal(state.evidence[`${courseId}/module/collections`].independent, 1, "Checkpoints count for their module");
});
