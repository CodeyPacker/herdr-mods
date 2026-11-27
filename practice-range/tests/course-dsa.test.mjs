import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";
import { loadCourse, listCourses, taskFor } from "../mods/practice-range/courses/loader.mjs";

const courseId = "course:dsa", moduleId = `${courseId}/module/search`;

test("the data structures course pack is complete and registered as a second TypeScript course", async () => {
  const pack = await loadCourse(courseId);
  assert.equal(pack.languageId, "typescript");
  assert.equal(pack.preview, true);
  assert.equal(pack.modules.length, 14);
  assert.ok(pack.modules.every(entry => entry.status === "available"));
  const tasks = pack.lessons.flatMap(lesson => lesson.tasks);
  assert.equal(tasks.length, 42, "three exercises in each of 14 modules");
  assert.equal(pack.readiness.length, 3);
  assert.equal(pack.project, undefined);
  for (const lesson of pack.lessons) {
    assert.equal(lesson.tasks.length, 3, lesson.id);
    assert.ok(lesson.questions.length >= 2, `${lesson.id} asks for predictions`);
    assert.ok(Object.values(lesson.examples).every(example => Array.isArray(example.stdout)), `${lesson.id} examples run`);
    // Every exercise is reached from a step, and every step's exercise exists.
    const shown = new Set(lesson.steps.flatMap(step => [...(step.tasks ?? []), ...(step.task ? [step.task] : [])]));
    assert.deepEqual([...shown].sort(), lesson.tasks.map(task => task.id).sort(), lesson.id);
  }
  for (const task of [...tasks, ...pack.readiness.map(group => group.task)]) {
    assert.equal(task.mode, "script", task.id);
    assert.equal(task.hints.length, 3, task.id);
    assert.equal(task.checkLabels.length, task.checks.length, `${task.id} describes every check`);
    assert.ok(task.checks.length >= 3, `${task.id} has more than a token check`);
    assert.notEqual(task.starter.trim(), task.solution.trim(), task.id);
  }
  // The course teaches in TypeScript and makes no comparison with any other language.
  const text = JSON.stringify({ lessons: pack.lessons.map(({ intro, steps, questions, tasks }) => ({ intro, steps, questions,
    tasks: tasks.map(({ title, prompt, hints, feedback }) => ({ title, prompt, hints, feedback })) })),
    readiness: pack.readiness.map(({ task }) => [task.prompt, task.hints, task.feedback]) });
  assert.doesNotMatch(text, /JavaScript|Python|C#|\bJava\b|\bC\+\+|another language|other languages/i);
  const courses = await listCourses();
  const summary = courses.find(course => course.id === courseId);
  assert.deepEqual([summary.languageId, summary.available, summary.total], ["typescript", 14, 14]);
  assert.deepEqual(courses.filter(course => course.languageId === "typescript").map(course => course.id), ["course:ts-foundations", courseId]);
});

test("the data structures course runs examples and checks answers, including how much work they do", { timeout: 240000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-course-dsa-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pack = await loadCourse(courseId);
  const run = (action, value = {}) => courseCommand(root, action, { courseId, ...value });
  await run("enroll");
  await run("open", { moduleId, step: 1 });
  let state = await run("question", { moduleId, questionId: "looks", choice: 1 });
  assert.equal(state.enrollment.modules[moduleId].questions.looks.correct, true);
  state = await run("example", { moduleId, exampleId: "binary" });
  assert.equal(state.enrollment.modules[moduleId].examples.binary.passed, true);
  assert.deepEqual(state.enrollment.tasks, {}, "Examples and questions are not coding evidence");

  // A search that gives right answers and reads every element fails only the check that counts reads.
  const taskId = `${courseId}/task/search-first-at-least`, { task } = taskFor(pack, taskId);
  state = await run("task", { taskId });
  assert.match(state.file, /Exercise\.ts$/);
  state = await run("check-saved", { taskId });
  assert.equal(state.enrollment.tasks[taskId].attempts, 0, "An unchanged starter is not an attempt");
  await writeFile(state.file, [
    "function firstAtLeast(values: number[], target: number): number {",
    "  for (let index = 0; index < values.length; index++) {",
    "    if (values[index] >= target) return index;",
    "  }",
    "  return values.length;",
    "}", ""].join("\n"));
  state = await run("check", { taskId });
  let progress = state.enrollment.tasks[taskId];
  assert.equal(progress.result.passed, false);
  assert.match(JSON.stringify(progress.result), /Read no more than 40 of the 100,000 elements/);
  await writeFile(state.file, task.solution);
  state = await run("check", { taskId });
  progress = state.enrollment.tasks[taskId];
  assert.equal(progress.result.passed, true);
  assert.equal(progress.independentPasses, 1);

  // A syntax rule turns away the built-in method an exercise asks the learner to write.
  const sortId = `${courseId}/task/sorting-insertion-sort`;
  state = await run("task", { taskId: sortId });
  await writeFile(state.file, "function insertionSort(values: number[]): number[] {\n  return values.sort((a, b) => a - b);\n}\n");
  state = await run("check", { taskId: sortId });
  assert.equal(state.enrollment.tasks[sortId].result.passed, false);
  assert.match(JSON.stringify(state.enrollment.tasks[sortId].result), /Write the sort yourself/);

  // The last exercise of the course.
  const gridId = `${courseId}/task/choose-shortest-grid-path`;
  state = await run("task", { taskId: gridId });
  await writeFile(state.file, taskFor(pack, gridId).task.solution);
  state = await run("check", { taskId: gridId });
  assert.equal(state.enrollment.tasks[gridId].result.passed, true);
});

test("the experienced path of the data structures course offers its three readiness tasks", async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-course-dsa-ready-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const state = await courseCommand(root, "enroll", { courseId, entryPath: "experienced" });
  assert.equal(state.enrollment.entryPath, "experienced");
  assert.deepEqual(state.course.readiness.map(group => group.id), ["R1", "R2", "R3"]);
});
