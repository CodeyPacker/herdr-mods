import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand, enrollmentDirectory } from "../mods/practice-range/courses/service.mjs";
import { loadCourse, taskFor, validatePack } from "../mods/practice-range/courses/loader.mjs";

const courseId = "course:ts-foundations", taskId = `${courseId}/task/report-audit`;

test("project checks snapshot both editable files, keep trusted files separate, and back up both on reset", async t => {
  const root = await mkdtemp(join(tmpdir(), "herdr-course-project-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pack = await loadCourse(courseId), { task } = taskFor(pack, taskId);
  const run = action => courseCommand(root, action, { courseId, taskId });
  await run("enroll");
  let state = await run("task");
  const folder = state.folder;
  assert.equal(state.file, join(folder, "audit.ts"));
  assert.equal(await readFile(join(folder, "audit.test.ts"), "utf8"), task.workspace.editable[1].starter);
  const visible = state.course.lessons.find(lesson => lesson.id.endsWith("/report")).tasks[0];
  assert.equal(visible.workspace.editable[1].solution, null);
  state = await run("check-saved");
  assert.equal(state.enrollment.tasks[taskId].attempts, 0);
  for (const file of task.workspace.editable) await writeFile(join(folder, file.file), file.solution);
  // Changing a supplied file cannot replace the trusted copy used to check a submission.
  await writeFile(join(folder, "contract.ts"), "This is not valid TypeScript.\n");
  state = await run("check-saved");
  assert.equal(state.enrollment.tasks[taskId].result.passed, true);
  assert.equal(state.enrollment.tasks[taskId].attempts, 1);
  assert.equal(state.enrollment.tasks[taskId].independentPasses, 1);
  await writeFile(join(folder, "audit.test.ts"), task.workspace.editable[1].starter);
  assert.equal((await run("status")).stale, true, "Changing only the second file makes the saved verdict stale");
  state = await run("check-saved");
  assert.equal(state.enrollment.tasks[taskId].result.passed, false);
  assert.equal(state.enrollment.tasks[taskId].attempts, 2);
  assert.match(state.enrollment.tasks[taskId].result.details.join("\n"), /regression accepts a correct implementation/);
  assert.doesNotMatch(state.enrollment.tasks[taskId].result.details.join("\n"), /const correct/);
  state = await run("reset");
  for (const file of task.workspace.editable) assert.equal(await readFile(join(folder, file.file), "utf8"), file.starter);
  const backup = join(enrollmentDirectory(root, pack), "history", "report-audit");
  const [stamp] = await readdir(backup);
  assert.deepEqual((await readdir(join(backup, stamp))).sort(), ["audit.test.ts", "audit.ts"]);
  assert.equal(await readFile(join(backup, stamp, "audit.ts"), "utf8"), task.workspace.editable[0].solution);
});

test("project file manifests reject traversal, duplicate files, and supplied/learner collisions", async () => {
  const original = await loadCourse(courseId);
  for (const name of ["../outside.ts", "check.ts", "contract.ts"]) {
    const pack = structuredClone(original), { task } = taskFor(pack, taskId);
    task.workspace.editable[0].file = name;
    assert.throws(() => validatePack(pack), /project filename/);
  }
  const pack = structuredClone(original), { task } = taskFor(pack, taskId);
  task.workspace.editable[1].file = task.workspace.editable[0].file;
  assert.throws(() => validatePack(pack), /project filename/);
});
