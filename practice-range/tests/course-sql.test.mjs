import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";
import { loadCourse, listCourses, taskFor } from "../mods/practice-range/courses/loader.mjs";

const courseId = "course:sql-foundations", moduleId = `${courseId}/module/where`;

test("the SQL course pack is complete, registered and written for SQL alone", async () => {
  const pack = await loadCourse(courseId);
  assert.equal(pack.languageId, "sql");
  assert.equal(pack.preview, true);
  assert.equal(pack.modules.length, 18);
  assert.ok(pack.modules.every(entry => entry.status === "available"));
  const tasks = pack.lessons.flatMap(lesson => lesson.tasks);
  assert.equal(tasks.length, 56, "52 lesson tasks plus four project checkpoints");
  assert.equal(pack.readiness.length, 4);
  assert.equal(pack.project.checkpoints.length, 5);
  for (const checkpoint of pack.project.checkpoints) assert.equal(taskFor(pack, checkpoint.taskId).lesson.id, checkpoint.module);
  for (const task of [...tasks, ...pack.readiness.map(group => group.task)]) {
    assert.equal(task.mode, "query", task.id);
    assert.ok(task.solution.trim(), `${task.id} is checked against its reference answer`);
    assert.equal(task.workspace, undefined);
  }
  const text = JSON.stringify({ lessons: pack.lessons.map(({ intro, steps, questions, tasks }) => ({ intro, steps, questions,
    tasks: tasks.map(({ title, prompt, hints, feedback }) => ({ title, prompt, hints, feedback })) })),
    readiness: pack.readiness.map(({ task }) => [task.prompt, task.hints, task.feedback]) });
  assert.doesNotMatch(text, /TypeScript|JavaScript|Python|C#|\bJava\b|another language|other languages/i);
  const summary = (await listCourses()).find(course => course.id === courseId);
  assert.deepEqual([summary.languageId, summary.available, summary.total], ["sql", 18, 18]);
});

test("a SQL course runs examples and checks saved answers on every case", { timeout: 240000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-course-sql-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pack = await loadCourse(courseId);
  const run = (action, value = {}) => courseCommand(root, action, { courseId, ...value });
  await run("enroll");
  await run("open", { moduleId, step: 1 });
  let state = await run("question", { moduleId, questionId: "count-sales", choice: 1 });
  assert.equal(state.enrollment.modules[moduleId].questions["count-sales"].correct, true);

  state = await run("example", { moduleId, exampleId: "sales" });
  assert.equal(state.enrollment.modules[moduleId].examples.sales.passed, true);
  assert.match(state.enrollment.modules[moduleId].examples.sales.details.join("\n"), /Priya[\s\S]*\(4 rows\)/);
  state = await run("example", { moduleId, exampleId: "quotes" });
  assert.equal(state.enrollment.modules[moduleId].examples.quotes.passed, true);
  assert.match(state.enrollment.modules[moduleId].examples.quotes.details.join("\n"), /42703/);
  assert.deepEqual(state.enrollment.tasks, {}, "Examples and questions are not coding evidence");

  // A query task with two cases. The second case changes the data, which a too-narrow answer misses.
  const taskId = `${courseId}/task/where-small-items`, { task } = taskFor(pack, taskId);
  state = await run("task", { taskId });
  assert.match(state.file, /Exercise\.sql$/);
  assert.match(await readFile(join(dirname(state.file), "schema.sql"), "utf8"), /CREATE TABLE products/);
  state = await run("check-saved", { taskId });
  assert.equal(state.enrollment.tasks[taskId].attempts, 0, "An unchanged starter is not an attempt");
  await writeFile(state.file, "SELECT name, price FROM products WHERE category_id IN (4, 8) AND price < 50;\n");
  state = await run("check", { taskId });
  let progress = state.enrollment.tasks[taskId];
  assert.equal(progress.result.passed, false);
  assert.match(JSON.stringify(progress.result), /Case edge/);
  assert.doesNotMatch(JSON.stringify(progress.result), /Case practice/, "The answer is right on the unchanged data");
  await writeFile(state.file, task.solution);
  state = await run("check", { taskId });
  progress = state.enrollment.tasks[taskId];
  assert.equal(progress.result.passed, true);
  assert.equal(progress.result.fixtures.length, 2);

  // A task that changes data is checked by the state it leaves behind.
  const restockId = `${courseId}/task/modify-restock`;
  state = await run("task", { taskId: restockId });
  await writeFile(state.file, "UPDATE products SET stock = 20;\n");
  state = await run("check", { taskId: restockId });
  assert.equal(state.enrollment.tasks[restockId].result.passed, false);
  await writeFile(state.file, taskFor(pack, restockId).task.solution);
  state = await run("check", { taskId: restockId });
  assert.equal(state.enrollment.tasks[restockId].result.passed, true);

  // A table design is checked by a row it must accept and rows it must reject.
  const tableId = `${courseId}/task/tables-shipments`;
  state = await run("task", { taskId: tableId });
  await writeFile(state.file, "CREATE TABLE shipments (id integer PRIMARY KEY, order_id integer NOT NULL, weight_kg numeric(6, 2) NOT NULL CHECK (weight_kg > 0), shipped_on date NOT NULL);\n");
  state = await run("check", { taskId: tableId });
  assert.equal(state.enrollment.tasks[tableId].result.passed, false);
  assert.match(JSON.stringify(state.enrollment.tasks[tableId].result), /should be rejected/);
  await writeFile(state.file, taskFor(pack, tableId).task.solution);
  state = await run("check", { taskId: tableId });
  assert.equal(state.enrollment.tasks[tableId].result.passed, true);

  // The final assessment.
  const reportId = `${courseId}/task/report-review-report`;
  state = await run("task", { taskId: reportId });
  await writeFile(state.file, taskFor(pack, reportId).task.solution);
  state = await run("check", { taskId: reportId });
  assert.equal(state.enrollment.tasks[reportId].result.passed, true);
  assert.equal(state.enrollment.tasks[reportId].independentPasses, 1);
});
