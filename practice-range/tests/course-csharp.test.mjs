import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";
import { loadCourse, listCourses, taskFor } from "../mods/practice-range/courses/loader.mjs";

const courseId = "course:cs-foundations", moduleId = `${courseId}/module/values`;

test("the C# course pack is complete, registered and written for C# alone", async () => {
  const pack = await loadCourse(courseId);
  assert.equal(pack.languageId, "csharp");
  assert.equal(pack.preview, true);
  assert.equal(pack.modules.length, 18);
  assert.ok(pack.modules.every(entry => entry.status === "available"));
  assert.equal(pack.lessons.length, 18);
  const tasks = pack.lessons.flatMap(lesson => lesson.tasks);
  assert.equal(tasks.length, 61, "57 lesson tasks plus four project checkpoints");
  assert.equal(pack.readiness.length, 4);
  assert.equal(pack.project.checkpoints.length, 5);
  for (const checkpoint of pack.project.checkpoints) assert.equal(taskFor(pack, checkpoint.taskId).lesson.id, checkpoint.module);
  for (const task of [...tasks, ...pack.readiness.map(group => group.task)]) {
    assert.ok(["statements", "members", "types"].includes(task.mode), task.id);
    assert.equal(task.checkLabels.length, task.checks.length, `${task.id} needs a plain label for every check`);
    assert.equal(task.workspace, undefined, `${task.id} must be a single-file task`);
    assert.equal(task.typeChecks, undefined);
  }
  // The course teaches C# on its own terms. Learner-facing text never leans on another language.
  const text = JSON.stringify({ lessons: pack.lessons.map(({ intro, steps, questions, tasks }) => ({ intro, steps, questions,
    tasks: tasks.map(({ title, prompt, hints, feedback, checkLabels }) => ({ title, prompt, hints, feedback, checkLabels })) })),
    readiness: pack.readiness.map(({ task }) => [task.prompt, task.hints, task.feedback]) });
  assert.doesNotMatch(text, /TypeScript|JavaScript|Python|\bJava\b|another language|other languages/i);
  const summary = (await listCourses()).find(course => course.id === courseId);
  assert.deepEqual([summary.languageId, summary.available, summary.total], ["csharp", 18, 18]);
});

test("a C# course runs examples and checks a saved answer against every case", { timeout: 240000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-course-csharp-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pack = await loadCourse(courseId);
  const run = (action, value = {}) => courseCommand(root, action, { courseId, ...value });
  await run("enroll");
  await run("open", { moduleId, step: 1 });
  let state = await run("question", { moduleId, questionId: "predict-count", choice: 0 });
  assert.equal(state.enrollment.modules[moduleId].questions["predict-count"].correct, true);

  state = await run("example", { moduleId, exampleId: "board" });
  assert.equal(state.enrollment.modules[moduleId].examples.board.passed, true);
  assert.match(state.enrollment.modules[moduleId].examples.board.details.join("\n"), /4\n5\n4/);
  state = await run("example", { moduleId, exampleId: "bad-count" });
  assert.equal(state.enrollment.modules[moduleId].examples["bad-count"].passed, true);
  assert.match(state.enrollment.modules[moduleId].examples["bad-count"].details.join("\n"), /CS0029/);
  assert.deepEqual(state.enrollment.tasks, {}, "Examples and questions are not coding evidence");

  // A statements task with three supplied cases and printed output.
  const taskId = `${courseId}/task/values-arrival-log`, { task } = taskFor(pack, taskId);
  await run("open", { moduleId, step: 8 });
  state = await run("task", { taskId });
  assert.match(state.file, /Exercise\.cs$/);
  state = await run("check-saved", { taskId });
  assert.equal(state.enrollment.tasks[taskId].attempts, 0, "An unchanged starter is not an attempt");
  await writeFile(state.file, "int total = opening;\nConsole.WriteLine(total);\ntotal = arrivals;\nConsole.WriteLine(total);\n");
  state = await run("check", { taskId });
  let progress = state.enrollment.tasks[taskId];
  assert.equal(progress.result.passed, false);
  assert.match(JSON.stringify(progress.result), /Case morning/);
  assert.match(JSON.stringify(progress.result), /Check 1 failed: The output must be the opening count/, "A failed check shows its plain label");
  await writeFile(state.file, task.solution);
  state = await run("check", { taskId });
  progress = state.enrollment.tasks[taskId];
  assert.equal(progress.result.passed, true);
  assert.equal(progress.result.fixtures.length, 3);
  assert.equal(progress.attempts, 2);

  // A members task that uses supplied record types.
  const laneId = `${courseId}/task/patterns-lane`;
  await run("open", { moduleId: `${courseId}/module/patterns`, step: 9 });
  state = await run("task", { taskId: laneId });
  await writeFile(state.file, taskFor(pack, laneId).task.solution);
  state = await run("check", { taskId: laneId });
  assert.equal(state.enrollment.tasks[laneId].result.passed, true);
  assert.equal(state.enrollment.tasks[laneId].independentPasses, 1);

  // The final assessment: async methods, a trusted helper and a learner-written check.
  const auditId = `${courseId}/task/report-audit`;
  await run("open", { moduleId: `${courseId}/module/report`, step: 3 });
  state = await run("task", { taskId: auditId });
  state = await run("check", { taskId: auditId });
  assert.equal(state.enrollment.tasks[auditId].result.passed, false, "The starter must not pass the final assessment");
  await writeFile(state.file, taskFor(pack, auditId).task.solution);
  state = await run("check", { taskId: auditId });
  assert.equal(state.enrollment.tasks[auditId].result.passed, true);
});
