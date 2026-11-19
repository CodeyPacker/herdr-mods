import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readyForReview, reviewSet, restingTime, neededHelp } from "../mods/syntax/review.js";
import { command } from "../mods/syntax/runner.mjs";
import { completeSetup } from "../mods/syntax/setup.mjs";

const day = 86400000;
const installed = { run: async () => ({ code: 0, stdout: "test", stderr: "", problem: "" }) };
const catalog = {
  topics: ["a", "b", "c", "d"].map(id => ({ id, exercises: Array.from({ length: 6 }, (_, index) => ({ id: `e${index}` })) })),
};
const clean = { attempts: 1, passes: 1, independentPasses: 1 };

test("review waits longer for exercises you knew, and doubles after each clean review", () => {
  assert.equal(neededHelp(clean), false);
  assert.equal(neededHelp({ ...clean, hinted: true }), true);
  assert.equal(neededHelp({ attempts: 3, passes: 1, independentPasses: 1 }), true);
  assert.equal(neededHelp({ attempts: 1, passes: 1, independentPasses: 0 }), true, "Passed only after seeing the answer");
  assert.equal(restingTime(clean), 3 * day);
  assert.equal(restingTime({ ...clean, hinted: true }), day);
  assert.equal(restingTime({ ...clean, review: { streak: 0, at: 0 } }), day);
  assert.equal(restingTime({ ...clean, review: { streak: 3, at: 0 } }), 8 * day);
});

test("ready exercises come from other practiced topics, weakest and longest unseen first", () => {
  const now = 100 * day;
  const progress = {
    "a/e0": { ...clean, last: now - 10 * day },
    "a/e1": { ...clean, hinted: true, last: now - 2 * day },
    "a/e2": { ...clean, last: now - day },                               // known, rested 1 of 3 days
    "b/e0": { ...clean },                                                  // from before review: no date
    "b/e1": { ...clean, review: { streak: 2, at: now - 3 * day } },       // rested 3 of 4 days
    "c/e0": { attempts: 2, passes: 0, independentPasses: 0, last: now - 5 * day },
    "d/e0": { ...clean, last: now - 30 * day },                           // current topic
  };
  const ready = readyForReview(catalog, progress, "d", now);
  assert.deepEqual(ready.map(item => item.id), ["c/e0", "a/e1", "b/e0", "a/e0"]);
  assert.deepEqual(ready.map(item => item.weak), [true, true, false, false]);
});

test("a review set has at most eight, three per topic, and alternates topics", () => {
  const progress = Object.fromEntries(catalog.topics.flatMap(topic => topic.exercises.map(exercise => [`${topic.id}/${exercise.id}`, { ...clean }])));
  const set = reviewSet(readyForReview(catalog, progress, "d", 100 * day));
  assert.equal(set.length, 8);
  assert.deepEqual(set, ["a/e0", "b/e0", "c/e0", "a/e1", "b/e1", "c/e1", "a/e2", "b/e2"]);
});

test("a review runs in blank files, records what you remembered, and returns you to your place", { timeout: 180000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-review-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await completeSetup(root, "neovim", "sql", installed);
  let state = await command(root, "select", "select/star");
  await writeFile(state.file, "SELECT * FROM categories;\n");
  state = await command(root, "check");
  assert.equal(state.result.passed, true);
  state = await command(root, "select", "select/two-columns");
  await writeFile(state.file, "SELECT name, price FROM products;\n");
  await command(root, "check");
  state = await command(root, "select", "where/and");
  assert.equal(state.reviewReady, 0, "Just practiced: nothing has rested long enough");

  // Age the practice, as if those checks happened a week ago.
  const sessionFile = join(root, "languages", "sql", "session.json");
  const session = JSON.parse(await readFile(sessionFile, "utf8"));
  for (const entry of Object.values(session.progress)) entry.last -= 7 * day;
  await writeFile(sessionFile, JSON.stringify(session));
  state = await command(root, "status");
  assert.equal(state.reviewReady, 2);
  const pathFile = state.file;

  state = await command(root, "review-start");
  assert.deepEqual(state.review.ids, ["select/star", "select/two-columns"]);
  assert.equal(state.exerciseId, "select/star");
  assert.equal(state.file, join(root, "languages", "sql", "answers", "_review", "select", "star", "Exercise.sql"));
  assert.equal(await readFile(state.file, "utf8"), "-- Write your SQL here. Save to check.\n", "Review starts blank");
  assert.match(await readFile(join(state.folder, "README.md"), "utf8"), /# Every column/);
  await writeFile(state.file, "SELECT * FROM categories;\n");
  state = await command(root, "check");
  assert.deepEqual(state.review.outcomes["select/star"], { checks: 1, passed: true, clean: true });
  assert.equal(state.progress["select/star"].review.streak, 1);
  assert.equal(await readFile(join(root, "languages", "sql", "answers", "select", "star", "Exercise.sql"), "utf8"), "SELECT * FROM categories;\n", "The saved answer is untouched");

  state = await command(root, "next");
  assert.equal(state.exerciseId, "select/two-columns");
  assert.equal(state.result, null);
  await writeFile(state.file, "SELECT name FROM products;\n");
  state = await command(root, "check");
  assert.equal(state.result.passed, false);
  state = await command(root, "hint");
  await writeFile(state.file, "SELECT name, price FROM products;\n");
  state = await command(root, "check");
  assert.deepEqual(state.review.outcomes["select/two-columns"], { checks: 2, passed: true, clean: false });
  assert.equal(state.progress["select/two-columns"].review.streak, 0, "A retry means it comes back sooner");

  state = await command(root, "next");
  assert.equal(state.review, null);
  assert.equal(state.exerciseId, "where/and", "Finishing returns you to your place");
  assert.equal(state.file, pathFile);
  assert.deepEqual({ ...state.lastReview, at: 0 }, { at: 0, total: 2, clean: 1, retried: 1, missed: 0 });
  assert.equal(state.reviewReady, 0);

  // Selecting an exercise mid-review ends it too. Rest the clean one long enough to return.
  const current = JSON.parse(await readFile(sessionFile, "utf8"));
  current.progress["select/star"].review.at -= 2 * day;
  await writeFile(sessionFile, JSON.stringify(current));
  state = await command(root, "review-start");
  assert.deepEqual(state.review.ids, ["select/star"]);
  state = await command(root, "select", "where/or");
  assert.equal(state.review, null);
  assert.equal(state.exerciseId, "where/or");
  assert.equal(state.lastReview.missed, 1);
});

test("send to scratch copies the answer with what it needs and runs it", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-send-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await completeSetup(root, "neovim", "sql", installed);
  let state = await command(root, "select", "functions/trim");
  await writeFile(state.file, "SELECT id, TRIM(city) AS city FROM customers;\n");
  await mkdir(join(root, "languages", "sql", "answers", "_scratch"), { recursive: true });
  await writeFile(join(root, "languages", "sql", "answers", "_scratch", "Scratch.sql"), "SELECT 'keep me';\n");
  state = await command(root, "send-to-scratch");
  assert.equal(state.scratch, true);
  const scratch = await readFile(state.file, "utf8");
  assert.match(scratch, /^-- Added by the exercise:\nUPDATE customers SET city = '  ' \|\| city[\s\S]*\n\nSELECT id, TRIM\(city\) AS city FROM customers;\n$/);
  assert.equal(state.scratchResult.title, "Ran your SQL");
  assert.match(state.scratchResult.details.at(-1), /^Statement 2 returned:\n id \| city\n/);
  assert.equal(state.stale, false);
  const history = join(root, "languages", "sql", "history", "_scratch");
  assert.equal((await readdir(history)).length, 1, "Earlier scratch work is backed up");
  assert.equal(await readFile(join(root, "languages", "sql", "answers", "functions", "trim", "Exercise.sql"), "utf8"), "SELECT id, TRIM(city) AS city FROM customers;\n");
});
