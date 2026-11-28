import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";
import { loadCourse, listCourses, taskFor } from "../mods/practice-range/courses/loader.mjs";
import { canMigrate, migrateState } from "../mods/practice-range/courses/migrate.mjs";

const courseId = "course:cs-foundations", moduleId = `${courseId}/module/values`;
/** Compiler errors from building the editor project in a folder, or "" when it builds. */
function editorBuild(folder) {
  const result = spawnSync("dotnet", ["build", "Practice.csproj", "--nologo", "--verbosity", "quiet"], { cwd: folder, encoding: "utf8", timeout: 120000 });
  return result.status === 0 ? "" : [...new Set((result.stdout + result.stderr).match(/error \w+: [^\[\r\n]*/g) ?? ["build failed"])].join("\n");
}

test("the C# course pack is complete, registered and written for C# alone", async () => {
  const pack = await loadCourse(courseId);
  assert.equal(pack.languageId, "csharp");
  assert.equal(pack.preview, true);
  assert.equal(pack.title, "C#");
  assert.equal(pack.modules.length, 19);
  assert.ok(pack.modules.every(entry => entry.status === "available"));
  assert.equal(pack.lessons.length, 19);
  const tasks = pack.lessons.flatMap(lesson => lesson.tasks);
  assert.equal(tasks.length, 63);
  assert.equal(pack.readiness.length, 4);
  // D11: no project and no capstone.
  assert.equal(pack.project, undefined);
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
  assert.doesNotMatch(text, /tracker|task board/i, "D11: no task tracker theme");
  const summary = (await listCourses()).find(course => course.id === courseId);
  assert.deepEqual([summary.languageId, summary.available, summary.total], ["csharp", 19, 19]);
});

test("the revised C# course retains earlier lessons and asks for new evidence on changed assessments", async () => {
  const previous = await loadCourse(courseId, "0.3.0-preview.1");
  const current = await loadCourse(courseId);
  assert.equal(previous.lessons.flatMap(lesson => lesson.tasks).length, 53);
  const changed = ["methods-summary", "checks-at-limit", "exceptions-parse-minutes", "linq-minutes-by-owner", "classes-task-card", "records-complete-all", "async-total", "async-counts"].map(id => `${courseId}/task/${id}`);
  const unchanged = `${courseId}/task/values-arrival-log`;
  const passed = { attempts: 2, passes: 1, independentPasses: 1, history: [{ passed: true }], result: { passed: true } };
  const state = { contentVersion: previous.contentVersion, tasks: Object.fromEntries([...changed, unchanged].map(id => [id, structuredClone(passed)])), modules: {} };
  const next = migrateState(state, previous, current, 42);
  for (const id of changed) {
    assert.equal(next.tasks[id].independentPasses, 0, id);
    assert.deepEqual(next.tasks[id].history, passed.history);
    assert.deepEqual(next.tasks[id].retake, { from: id, at: 42 });
  }
  assert.deepEqual(next.tasks[unchanged], passed);
  assert.equal(next.tasks[`${courseId}/task/async-parallel`], undefined);
  assert.equal(next.tasks[`${courseId}/task/exceptions-cleanup`], undefined);
  assert.equal(state.tasks[changed[0]].independentPasses, 1, "Earlier enrollment is unchanged");
  assert.deepEqual(current.readiness.find(group => group.id === "R3").modules, [`${courseId}/module/patterns`, `${courseId}/module/exceptions`]);
});

test("the C# course keeps prerequisites, task placement and assessments connected", async () => {
  const pack = await loadCourse(courseId);
  const draft = JSON.parse(await readFile(new URL("../course-drafts/csharp/manifest.json", import.meta.url), "utf8"));
  const modules = new Map(pack.modules.map(module => [module.id, module]));
  const concepts = id => {
    const seen = new Set();
    const visit = moduleId => {
      for (const prerequisite of modules.get(moduleId).prerequisites) {
        if (seen.has(prerequisite)) continue;
        seen.add(prerequisite);
        visit(prerequisite);
      }
    };
    visit(id);
    return new Set([...seen].flatMap(moduleId => modules.get(moduleId).teaches));
  };
  for (const lesson of pack.lessons) {
    assert.ok(lesson.requires.every(concept => concepts(lesson.id).has(concept)), `${lesson.id} requires concepts taught by a prerequisite`);
    const referenced = new Set(lesson.steps.flatMap(step => [...(step.task ? [step.task] : []), ...(step.tasks ?? [])]));
    if (lesson.review?.task) referenced.add(lesson.review.task);
    for (const task of lesson.tasks) {
      const localId = task.id.slice(task.id.lastIndexOf("/task/") + 6);
      assert.ok(referenced.has(task.id) || referenced.has(localId), `${task.id} appears in a lesson step or review`);
    }
    const lessonTaskIds = new Set(lesson.tasks.map(task => task.id));
    const questionIds = new Set(lesson.questions.map(question => question.id));
    for (const outcome of lesson.outcomes) {
      const assessments = Array.isArray(outcome.assessment) ? outcome.assessment : [outcome.assessment];
      for (const assessment of assessments) {
        const localTaskId = assessment.slice(assessment.lastIndexOf("/task/") + 6);
        assert.ok(lessonTaskIds.has(assessment) || lessonTaskIds.has(`${courseId}/task/${assessment}`) ||
          lessonTaskIds.has(`${courseId}/task/${localTaskId}`) || questionIds.has(assessment),
        `${lesson.id} outcome ${outcome.id} assessment ${assessment} resolves in that lesson`);
      }
    }
  }
  const moduleIds = new Set(pack.modules.map(module => module.id));
  const taskIds = new Set(pack.lessons.flatMap(lesson => lesson.tasks.map(task => task.id)));
  for (const outcome of draft.outcomes) {
    const assessments = Array.isArray(outcome.assessment) ? outcome.assessment : [outcome.assessment];
    for (const assessment of assessments) assert.ok(moduleIds.has(assessment) || taskIds.has(assessment), `${outcome.id} assessment ${assessment} resolves`);
  }
  const order = pack.modules.map(module => module.id);
  const position = key => order.indexOf(`${courseId}/module/${key}`);
  assert.ok(position("delegates") < position("linq"));
  assert.ok(position("delegates") < position("async"));
  assert.ok(position("delegates") < position("checks"));
  assert.ok(position("strings") < position("transfer"));
  assert.equal(position("transfer"), order.length - 1);
});

test("the 0.4 C# pack migrates without changing archived progress or granting new task credit", async () => {
  const previous = await loadCourse(courseId, "0.4.0-preview.1");
  const current = await loadCourse(courseId);
  const previousCopy = structuredClone(previous);
  assert.equal(previous.modules.length, 16);
  assert.equal(previous.lessons.flatMap(lesson => lesson.tasks).length, 55);
  assert.equal(canMigrate(previous, current), true);
  const addedTasks = current.lessons.filter(lesson => ["strings", "delegates", "transfer"].some(key => lesson.id.endsWith(`/module/${key}`)))
    .flatMap(lesson => lesson.tasks.map(task => task.id));
  const unchanged = `${courseId}/task/values-arrival-log`;
  const passed = { attempts: 2, passes: 1, independentPasses: 1, history: [{ passed: true }], result: { passed: true } };
  const state = { contentVersion: previous.contentVersion, tasks: { [unchanged]: structuredClone(passed) }, modules: {} };
  const next = migrateState(state, previous, current, 43);
  assert.deepEqual(next.tasks[unchanged], passed);
  for (const id of addedTasks) assert.equal(next.tasks[id], undefined, `${id} starts without completion evidence`);
  assert.deepEqual(previous, previousCopy, "Migration leaves the archived pack unchanged");
});

test("a C# course runs examples and checks a saved answer against every case", { timeout: 240000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-course-csharp-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pack = await loadCourse(courseId);
  const run = (action, value = {}) => courseCommand(root, action, { courseId, ...value });
  // Find steps by what they hold, so removing a step elsewhere in a module does not move these.
  const stepWith = (module, id) => pack.lessons.find(lesson => lesson.id === module).steps
    .findIndex(step => step.task === id || step.tasks?.includes(id) || step.questions?.includes(id));
  await run("enroll");
  await run("open", { moduleId, step: stepWith(moduleId, "predict-count") });
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
  await run("open", { moduleId, step: stepWith(moduleId, taskId) });
  state = await run("task", { taskId });
  assert.match(state.file, /Exercise\.cs$/);
  assert.doesNotMatch(state.file, /%/, "MSBuild misreads % in a path, which would break the C# editor project beside the answer");
  state = await run("check-saved", { taskId });
  assert.equal(state.enrollment.tasks[taskId].attempts, 0, "An unchanged starter is not an attempt");
  await writeFile(state.file, "int total = morning;\nConsole.WriteLine(total);\ntotal = walk;\nConsole.WriteLine(total);\n");
  state = await run("check", { taskId });
  let progress = state.enrollment.tasks[taskId];
  assert.equal(progress.result.passed, false);
  assert.match(JSON.stringify(progress.result), /Case morning/);
  assert.match(JSON.stringify(progress.result), /Check 1 failed: The output must be the morning steps/, "A failed check shows its plain label");
  await writeFile(state.file, task.solution);
  state = await run("check", { taskId });
  progress = state.enrollment.tasks[taskId];
  assert.equal(progress.result.passed, true);
  assert.equal(progress.result.fixtures.length, 3);
  assert.equal(progress.attempts, 2);
  // The editor project beside the answer knows the supplied values, so an editor reports no false errors.
  assert.equal(editorBuild(dirname(state.file)), "", "A correct statements answer must build in the editor project");

  // A members task that uses supplied record types.
  const laneId = `${courseId}/task/patterns-lane`;
  await run("open", { moduleId: `${courseId}/module/patterns`, step: stepWith(`${courseId}/module/patterns`, laneId) });
  state = await run("task", { taskId: laneId });
  await writeFile(state.file, taskFor(pack, laneId).task.solution);
  state = await run("check", { taskId: laneId });
  assert.equal(state.enrollment.tasks[laneId].result.passed, true);
  assert.equal(state.enrollment.tasks[laneId].independentPasses, 1);

  // A types task: the answer and the supplied interface build together in the editor project.
  const sourceId = `${courseId}/task/interfaces-fixed-source`;
  await run("open", { moduleId: `${courseId}/module/interfaces`, step: stepWith(`${courseId}/module/interfaces`, sourceId) });
  state = await run("task", { taskId: sourceId });
  assert.match(await readFile(join(dirname(state.file), "Supplied.cs"), "utf8"), /global using System\.Linq;[\s\S]*public interface ISongSource/);
  assert.equal(editorBuild(dirname(state.file)), "", "A types starter must build in the editor project with its supplied interface");

  // The last module's task: a learner-written check run against faulty and correct candidates.
  const auditId = `${courseId}/task/checks-order-check`;
  await run("open", { moduleId: `${courseId}/module/checks`, step: 0 });
  state = await run("task", { taskId: auditId });
  state = await run("check", { taskId: auditId });
  assert.equal(state.enrollment.tasks[auditId].result.passed, false, "The starter must not pass the last module's task");
  await writeFile(state.file, taskFor(pack, auditId).task.solution);
  state = await run("check", { taskId: auditId });
  assert.equal(state.enrollment.tasks[auditId].result.passed, true);
});
