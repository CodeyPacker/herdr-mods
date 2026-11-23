import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command } from "../mods/practice-range/runner.mjs";
import { completeSetup } from "../mods/practice-range/setup.mjs";
import { loadLanguageRunner } from "../mods/practice-range/languages/runner.mjs";

// Setup checks the editor command. These tests stub it so they never depend on a local editor.
const installed = { run: async () => ({ code: 0, stdout: "test", stderr: "", problem: "" }) };
const saved = state => JSON.stringify({ languageId: state.languageId, exerciseId: state.exerciseId, sourceHash: state.sourceHash });

async function practiceRoot(t, languages) {
  const root = await mkdtemp(join(tmpdir(), "syntax-scratch-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const id of languages) await completeSetup(root, "neovim", id, installed);
  return root;
}

test("scratch swaps in a free-form file, runs saves without checking, and keeps practice untouched", { timeout: 180000 }, async t => {
  const root = await practiceRoot(t, ["sql"]);
  let state = await command(root, "status");
  const exerciseFile = state.file;
  await writeFile(exerciseFile, "SELECT * FROM categories;\n");
  state = await command(root, "check");
  assert.equal(state.result.passed, true);

  state = await command(root, "scratch");
  assert.equal(state.scratch, true);
  assert.equal(state.file, join(root, "languages", "sql", "answers", "_scratch", "Scratch.sql"));
  assert.match(await readFile(state.file, "utf8"), /^-- Scratch:/);
  assert.match(await readFile(join(state.folder, "schema.sql"), "utf8"), /CREATE TABLE customers/);
  state = await command(root, "check-saved", saved(state));
  assert.equal(state.scratchResult ?? null, null, "The generated starter is not a save to run");

  await writeFile(state.file, "SELECT country, COUNT(*) AS n FROM customers GROUP BY country HAVING COUNT(*) > 3;\n");
  state = await command(root, "check-saved", saved(state));
  assert.equal(state.scratchResult.title, "Ran your SQL");
  assert.match(state.scratchResult.details[0], /^Your query returned:\n country \| n\n[\s\S]* USA +\| 7\n\(1 row\)$/);
  assert.equal(state.stale, false);
  const ranAt = state.scratchResult.at;
  state = await command(root, "check-saved", saved(state));
  assert.equal(state.scratchResult.at, ranAt, "A duplicate save event doesn't run again");
  state = await command(root, "check");
  assert.notEqual(state.scratchResult.at, ranAt, "An explicit run always runs");

  await writeFile(state.file, "SELECT * FROM nowhere;\n");
  state = await command(root, "check");
  assert.equal(state.scratchResult.kind, "compile");
  assert.match(state.scratchResult.details[0], /^Scratch\.sql:1:15 - error 42P01/);
  assert.equal(state.progress["select/star"].attempts, 1, "Scratch runs never count as attempts");
  assert.equal(state.result.passed, true, "The exercise's last check is kept");

  state = await command(root, "practice");
  assert.equal(state.scratch, false);
  assert.equal(state.file, exerciseFile);
  state = await command(root, "scratch");
  assert.equal(state.scratchResult.kind, "compile", "The last scratch run is kept while practicing");
  assert.equal(state.stale, false);
  state = await command(root, "select", "where/and");
  assert.equal(state.scratch, false, "Choosing an exercise leaves scratch");
  assert.match(state.file, /answers[\\/]where[\\/]and[\\/]Exercise\.sql$/);
});

test("TypeScript scratch type-checks and runs free-form code", { timeout: 120000 }, async t => {
  const root = await practiceRoot(t, ["typescript"]);
  const runner = await loadLanguageRunner("typescript");
  const scratch = join(root, "languages", "typescript");
  const ran = await runner.runScratch(scratch, "type Point = { x: number };\nconst p: Point = { x: 3 };\nconsole.log(`x is ${p.x}`);\n");
  assert.deepEqual(ran, { passed: true, kind: "output", title: "Ran your code", details: ["Your code printed:\nx is 3"] });
  const typed = await runner.runScratch(scratch, "const n: number = 'x';\n");
  assert.equal(typed.kind, "compile");
  assert.match(typed.details[0], /^Scratch\.ts:1:7 - error TS2322/);
  const thrown = await runner.runScratch(scratch, "console.log('before');\nthrow new RangeError('boom');\n");
  assert.equal(thrown.title, "Your code threw an error");
  assert.deepEqual(thrown.details, ["RangeError: boom", "at Scratch.ts:2:7", "Your code printed:\nbefore"]);
  const state = await command(root, "scratch");
  assert.match(await readFile(join(state.folder, "tsconfig.json"), "utf8"), /"strict": true/);
});
