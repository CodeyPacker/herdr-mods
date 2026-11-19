import { test } from "node:test";
import assert from "node:assert/strict";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import sql from "../mods/syntax/languages/sql/index.js";
import { catalogFor } from "../mods/syntax/catalog.js";
import { ruleFailures, tokenize, isBlank } from "../mods/syntax/languages/sql/lexer.js";

const { topics, exercises } = catalogFor(sql);

/**
 * Runs every reference answer of one topic. Each answer must return rows (or change data the
 * verify query sees), give the same result when the dataset's rows are stored in reverse order
 * (so the answer can't depend on physical row order or unordered LIMIT), and differ from what
 * a do-nothing answer produces. Rejected statements must fail after the reference answer.
 */
async function referenceProblems(topicId) {
  const { snapshot, open, lastResult } = await import("../mods/syntax/languages/sql/check.mjs");
  const { compareResults } = await import("../mods/syntax/languages/sql/compare.js");
  const { datasetSql } = await import("../mods/syntax/languages/sql/dataset.js");
  const normal = await snapshot(null), reversed = await snapshot(null, datasetSql({ reversed: true }));
  const run = async (blob, exercise, source) => {
    const db = await open(blob, exercise.setup);
    try {
      const results = await db.exec(source, { rowMode: "array" });
      const outcome = {
        result: (exercise.result ?? !exercise.verify) ? lastResult(results) : null,
        verify: exercise.verify ? lastResult(await db.exec(exercise.verify, { rowMode: "array" })) : null,
        rejected: [],
      };
      for (const statement of exercise.rejects ?? []) {
        try { await db.exec(`BEGIN; ${statement}; ROLLBACK;`); outcome.rejected.push(false); }
        catch { await db.exec("ROLLBACK;").catch(() => {}); outcome.rejected.push(true); }
      }
      return outcome;
    } finally { await db.close(); }
  };
  const differences = (left, right, ordered) => ["result", "verify"].flatMap(key => {
    if (!left[key] && !right[key]) return [];
    if (!left[key] || !right[key]) return [`${key} missing`];
    return compareResults(left[key], right[key], { ordered: key === "verify" || ordered });
  });
  const problems = [];
  for (const exercise of exercises.filter(item => item.topicId === topicId)) {
    try {
      const reference = await run(normal, exercise, exercise.solution);
      if (reference.result?.rows.length === 0) problems.push(`${exercise.id}: the reference returns no rows`);
      if (reference.verify?.rows.length === 0) problems.push(`${exercise.id}: the verify query returns no rows`);
      if (reference.rejected.includes(false)) problems.push(`${exercise.id}: a rejected statement succeeds after the reference`);
      const order = differences(reference, await run(reversed, exercise, exercise.solution), exercise.ordered);
      if (order.length) problems.push(`${exercise.id}: depends on row order: ${order.join(" ")}`);
      let idle = null;
      try { idle = await run(normal, exercise, (exercise.result ?? !exercise.verify) ? "SELECT 1 AS x;" : "SELECT 1;"); }
      catch { /* The verify query failed, so the check notices. */ }
      if (idle && !differences(reference, idle, exercise.ordered).length && !idle.rejected.includes(false)) problems.push(`${exercise.id}: a do-nothing answer passes`);
    } catch (error) {
      problems.push(`${exercise.id}: ${error.message}`);
    }
  }
  return problems;
}

if (!isMainThread) {
  parentPort.postMessage(await referenceProblems(workerData));
} else {
  test("the SQL catalog has 20 topics of 40 distinct, well-formed exercises", () => {
    assert.equal(topics.length, 20);
    assert.equal(exercises.length, 800);
    assert.equal(new Set(exercises.map(item => item.id)).size, 800);
    assert.equal(topics.filter(topic => topic.level === "advanced").length, 8);
    for (const topic of topics) {
      assert.equal(topic.exercises.length, 40, topic.id);
      assert.equal(new Set(topic.exercises.map(item => item.solution)).size, 40, `${topic.id}: solutions repeat`);
      assert.equal(new Set(topic.exercises.map(item => item.prompt)).size, 40, `${topic.id}: prompts repeat`);
    }
    for (const exercise of exercises) {
      assert.equal(exercise.hints.length, 3, exercise.id);
      assert.ok(exercise.hints[2].includes("___"), `${exercise.id}: the final hint stays a skeleton`);
      assert.ok(!exercise.hints.some(hint => hint.includes(exercise.solution.replace(/;$/, ""))), `${exercise.id}: hints must not reveal the answer`);
      assert.ok(exercise.rules.length > 0, exercise.id);
      assert.deepEqual(ruleFailures(exercise.solution, exercise.rules), [], `${exercise.id}: the reference must satisfy its own rules`);
      assert.ok(isBlank(exercise.starter), `${exercise.id}: the starter holds no SQL`);
      for (const rule of exercise.rules) assert.ok((rule.anyOf ?? [rule.has]).every(pattern => tokenize(pattern.replaceAll("...", " ")).length > 0), `${exercise.id}: empty rule`);
      if (exercise.tables.length || exercise.setup) assert.ok(exercise.declarations, `${exercise.id}: tables are shown`);
    }
  });

  test("the lexer ignores comments and strings, and rules can forbid syntax", () => {
    const answer = "-- LEFT JOIN in a comment\nSELECT 'GROUP BY' /* HAVING */ FROM t JOIN u ON true;";
    assert.deepEqual(ruleFailures(answer, [{ has: "JOIN", message: "join" }]), []);
    assert.deepEqual(ruleFailures(answer, [{ has: "LEFT JOIN", message: "left" }, { has: "GROUP BY", message: "group" }, { has: "HAVING", message: "having" }]), ["left", "group", "having"]);
    assert.deepEqual(ruleFailures("SELECT * FROM t WHERE a", [{ has: "WHERE", max: 0, message: "no where" }]), ["no where"]);
    assert.deepEqual(ruleFailures("SELECT CASE WHEN a THEN 1 END", [{ has: "CASE ... END", message: "case" }]), []);
    assert.deepEqual(ruleFailures("SELECT CASE; END", [{ has: "CASE ... END", message: "case" }]), ["case"], "... stays within one statement");
    assert.deepEqual(ruleFailures('SELECT name AS "Product Name" FROM p', [{ has: 'AS "Product Name"', message: "quoted" }]), []);
    assert.deepEqual(ruleFailures("SELECT $$ JOIN $$, E'it''s \\' JOIN'", [{ has: "JOIN", message: "join" }]), ["join"]);
    assert.ok(isBlank("-- only a comment\n/* and /* nested */ this */\n"));
  });

  test("all 800 SQL reference answers run, are deterministic, and are distinguishable from a do-nothing answer", { timeout: 1800000 }, async () => {
    const queue = topics.map(topic => topic.id);
    const problems = [];
    // Each worker restores its own databases; two at a time keeps memory modest.
    await Promise.all([0, 1].map(async () => {
      while (queue.length) {
        const topicId = queue.shift();
        problems.push(...await new Promise((resolve, reject) => {
          const worker = new Worker(new URL(import.meta.url), { workerData: topicId });
          worker.once("message", found => { worker.terminate(); resolve(found); });
          worker.once("error", reject);
        }));
      }
    }));
    assert.deepEqual(problems, []);
  });
}
