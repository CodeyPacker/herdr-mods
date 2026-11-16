import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { command } from "../mods/syntax/runner.mjs";
import { findExercise, topicExercises } from "../mods/syntax/catalog.js";
import { exerciseSource } from "../mods/syntax/languages/csharp/source.mjs";

test("a saved session stays on its topic, preserves answers, and restores hints after reopening", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-session-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let state = await command(root, "status");
  assert.equal(state.exerciseId, "variables/integer");
  const projectFile = join(state.folder, "Practice.csproj");
  const projectModifiedAt = (await stat(projectFile)).mtimeMs;
  await command(root, "hint");
  assert.equal((await stat(projectFile)).mtimeMs, projectModifiedAt, "Hints must not rewrite the editor project and restart tooling");
  await command(root, "select", "loops/for");
  const exercise = findExercise("loops/for");
  state = await command(root, "hint");
  state = await command(root, "hint");
  assert.equal(state.hintCount, 2);
  assert.equal((await command(root, "status")).hintCount, 2);
  for (let index = 0; index < 4; index++) state = await command(root, "hint");
  assert.equal(state.hintCount, 3);
  await writeFile(state.file, exerciseSource(exercise, exercise.solution));
  state = await command(root, "check");
  assert.equal(state.result.passed, true);
  assert.equal(state.exerciseId, "loops/for");
  assert.equal(state.progress[exercise.id].passes, 1);
  const previousSession = JSON.parse(await readFile(join(root, "session.json"), "utf8"));
  delete previousSession.languageId;
  await writeFile(join(root, "session.json"), JSON.stringify(previousSession));
  const reopened = await command(root, "status");
  assert.equal(reopened.languageId, "csharp");
  assert.equal(reopened.file, state.file);
  assert.deepEqual(reopened.progress, state.progress, "Opening an older session must preserve progress");
  await command(root, "answer");
  state = await command(root, "check");
  assert.equal(state.result.assisted, true);
  assert.equal(state.progress[exercise.id].independentPasses, 1);
  state = await command(root, "next");
  assert.ok(state.exerciseId.startsWith("loops/"));
  assert.equal(state.hintCount, 0);
  assert.equal(state.answerShown, false);
  state = await command(root, "select", exercise.id);
  assert.equal(await readFile(state.file, "utf8"), exerciseSource(exercise, exercise.solution));
  state = await command(root, "repeat");
  assert.equal(await readFile(state.file, "utf8"), exerciseSource(exercise));
  assert.equal((await readdir(join(root, "history", exercise.id))).length, 1);
  const last = topicExercises("loops").at(-1);
  await command(root, "select", last.id);
  assert.equal((await command(root, "next")).exerciseId, "loops/for");
  const advanced = findExercise("spans/ref-return");
  state = await command(root, "select", advanced.id);
  await writeFile(state.file, exerciseSource(advanced, advanced.solution));
  state = await command(root, "check");
  assert.equal(state.result.passed, true);
  assert.equal(state.progress[exercise.id].passes, 2, "Switching to advanced topics preserves previous progress");
  assert.ok((await command(root, "next")).exerciseId.startsWith("spans/"));
});

test("whole-file answers, changed code, invalid IDs, and concurrent actions are handled", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-structure-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let state = await command(root, "status");
  const exercise = findExercise(state.exerciseId);
  await writeFile(state.file, exerciseSource(exercise, exercise.solution).replaceAll("\n", "\r\n"));
  state = await command(root, "check");
  assert.equal(state.result.passed, true);
  await writeFile(state.file, exerciseSource(exercise, "int count = 99;"));
  state = await command(root, "status");
  assert.equal(state.stale, true);
  await writeFile(state.file, "// deleted everything");
  assert.equal((await command(root, "check")).result.kind, "compile");
  await writeFile(state.file, exercise.solution + "\n// Entire file is editable.");
  assert.equal((await command(root, "check")).result.passed, true);
  await writeFile(state.file, "int count = ;");
  state = await command(root, "check");
  assert.equal(state.result.kind, "compile");
  assert.match(state.result.details[0], /Exercise.cs\(1,/);
  await assert.rejects(command(root, "select", "../../outside"), /Unknown exercise/);
  await writeFile(join(root, "session.lock"), "test");
  await assert.rejects(command(root, "status"), /Another Practice Range action/);
  await rm(join(root, "session.lock"));
  await writeFile(join(root, "session.json"), "broken");
  await assert.rejects(command(root, "status"), /Cannot read/);
});

test("old marked answers migrate once with a full backup and retain progress", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-migration-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let state = await command(root, "status");
  const exercise = findExercise(state.exerciseId);
  const original = `using System;
using System.Collections.Generic;
using System.Linq;
using System.Globalization;
using System.Threading.Tasks;

public static class Practice
{
    public static void Run()
    {
// <answer>
${exercise.solution}
// </answer>
    }
}
`;
  await writeFile(state.file, original);
  await command(root, "hint");
  assert.equal(await readFile(state.file, "utf8"), exercise.solution + "\n");
  const history = join(root, "history", exercise.id);
  const backups = await readdir(history);
  assert.equal(backups.length, 1);
  assert.equal(await readFile(join(history, backups[0]), "utf8"), original);
  state = await command(root, "check");
  assert.equal(state.result.passed, true);
  assert.equal(state.hintCount, 1);
  assert.equal((await readdir(history)).length, 1);
  // Preserve nonstandard old files for the user to edit rather than discarding setup changes.
  await writeFile(state.file, original + "// custom setup\n");
  await command(root, "status");
  assert.equal(await readFile(state.file, "utf8"), original + "// custom setup\n");
});

test("save checks skip unchanged files, check new saves, and ignore the previous exercise", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-save-check-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let state = await command(root, "status");
  const exercise = findExercise(state.exerciseId);
  const pending = JSON.stringify({ exerciseId: state.exerciseId, sourceHash: state.sourceHash });
  state = await command(root, "check-saved", pending);
  assert.equal(state.result, null, "Creating the starter file must not count as a save attempt");
  await writeFile(state.file, exercise.solution + "\n");
  state = await command(root, "check-saved", pending);
  assert.equal(state.result.passed, true);
  assert.equal(state.progress[exercise.id].attempts, 1);
  state = await command(root, "check-saved", pending);
  assert.equal(state.progress[exercise.id].attempts, 1, "Duplicate save events must not inflate progress");
  await writeFile(state.file, "int count = ;\n");
  state = await command(root, "check-saved", pending);
  assert.equal(state.result.kind, "compile");
  assert.equal(state.progress[exercise.id].attempts, 2);
  await writeFile(state.file, exercise.solution + "\n");
  // A save arriving during a check can already be present in the returned file snapshot.
  state = await command(root, "status");
  assert.equal(state.stale, true);
  state = await command(root, "check-saved", JSON.stringify({ exerciseId: state.exerciseId, sourceHash: state.sourceHash }));
  assert.equal(state.result.passed, true);
  assert.equal(state.progress[exercise.id].attempts, 3);
  state = await command(root, "next");
  state = await command(root, "check-saved", pending);
  assert.equal(state.result, null);
  assert.equal(state.progress[exercise.id].attempts, 3);
  await command(root, "select", exercise.id);
  state = await command(root, "repeat");
  state = await command(root, "check-saved", JSON.stringify({ exerciseId: state.exerciseId, sourceHash: state.sourceHash }));
  assert.equal(state.result, null, "Resetting the starter must not immediately show errors");
});
