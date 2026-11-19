// Runs one SQL check. Two in-memory PostgreSQL databases are restored from the same snapshot:
// one runs the reference answer, the other runs the learner's answer, and their results are
// compared. engine.mjs runs this in a separate process with a time limit.
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite, types } from "@electric-sql/pglite";
import { datasetSql } from "./dataset.js";
import { compareResults, formatTable, rowChanges } from "./compare.js";

const maxRows = 5000;
// Keep every value as PostgreSQL's text output, so dates and numbers compare the same everywhere.
const parsers = Object.fromEntries(Object.values(types).filter(value => typeof value === "number").map(oid => [oid, text => text]));

/** The seeded database, built once and cached as an uncompressed data directory (about 40 MB), which restores fastest. Without a path, nothing is cached. */
export async function snapshot(path, sql = datasetSql()) {
  if (path) {
    try { return new Blob([await readFile(path)]); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const db = await PGlite.create();
  await db.exec(sql);
  const blob = await db.dumpDataDir("none");
  await db.close();
  if (!path) return blob;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, Buffer.from(await blob.arrayBuffer()));
  await rename(temporary, path);
  return blob;
}

export async function open(blob, setup) {
  const db = await PGlite.create({ loadDataDir: blob, parsers });
  await db.exec("SET TimeZone = 'UTC'; SET DateStyle = 'ISO, MDY'; SET IntervalStyle = 'postgres';");
  if (setup) await db.exec(setup);
  return db;
}

/** The last statement that returned columns, as arrays in column order. */
export function lastResult(results) {
  const result = [...results].reverse().find(item => item.fields.length > 0);
  if (!result) return null;
  if (result.rows.length > maxRows) throw Object.assign(new Error(`The query returned more than ${maxRows} rows. Check for a join without a condition.`), { learner: true });
  return { columns: result.fields.map(field => field.name), types: result.fields.map(field => field.dataTypeID), rows: result.rows };
}

/** PostgreSQL reports a 1-based character offset. Turn it into the answer's line and column. */
function location(source, position) {
  if (!position) return "";
  const lines = source.slice(0, Number(position) - 1).split("\n");
  return `Exercise.sql:${lines.length}:${lines.at(-1).length + 1} - `;
}

function describe(error, source) {
  const details = [`${location(source, error.position)}error ${error.code ?? ""}: ${error.message}`.replace("error : ", "error: ")];
  if (error.detail) details.push(error.detail);
  if (error.hint) details.push(`Hint from PostgreSQL: ${error.hint}`);
  return details;
}

/** What the check query shows changed: the affected rows before, then after. */
function describeChanges(before, after) {
  if (!before || !after || before.columns.join() !== after.columns.join()) return after ? `After your statements, the check query returns:\n${formatTable(after)}` : "";
  const { added, removed } = rowChanges(before, after);
  if (!added.rows.length && !removed.rows.length) return "The check query shows no changes.";
  const parts = [];
  if (removed.rows.length) parts.push(`Before (rows your statements changed or removed):\n${formatTable(removed)}`);
  if (added.rows.length) parts.push(`After (rows your statements changed or added):\n${formatTable(added)}`);
  return parts.join("\n\n");
}

/** @param {{ setup: string, solution: string, answer: string, verify: string, rejects: string[], ordered: boolean, compareResult: boolean }} job @param {Blob} blob */
export async function runCheck(job, blob) {
  const options = { rowMode: "array" };

  const reference = await open(blob, job.setup);
  const expected = { result: null, verify: null };
  try {
    const results = await reference.exec(job.solution, options);
    if (job.compareResult) expected.result = lastResult(results);
    if (job.verify) expected.verify = lastResult(await reference.exec(job.verify, options));
  } catch (error) {
    throw new Error(`The reference answer failed: ${error.message}`);
  }
  await reference.close();

  const learner = await open(blob, job.setup);
  // The check query before the answer runs, so the feedback can show what the answer changed.
  const before = job.verify ? lastResult(await learner.exec(job.verify, options)) : null;
  let results;
  try { results = await learner.exec(job.answer, options); }
  catch (error) { return { status: "error", details: describe(error, job.answer) }; }

  const problems = [];
  let output = "";
  let actual = null;
  try { actual = lastResult(results); }
  catch (error) { return { status: "mismatch", details: [error.message], output }; }
  if (actual) output = `Your query returned:\n${formatTable(actual)}`;
  else {
    const changed = results.reduce((total, result) => total + (result.affectedRows ?? 0), 0);
    if (changed) output = `Your statements changed ${changed} row${changed === 1 ? "" : "s"}.`;
  }
  if (job.compareResult) {
    if (!actual) return { status: "mismatch", details: ["Your answer didn't return a result. Write a query whose last statement returns rows."], output };
    problems.push(...compareResults(expected.result, actual, { ordered: job.ordered }));
  }
  if (job.verify && !problems.length) {
    try {
      const after = lastResult(await learner.exec(job.verify, options));
      if (!job.compareResult) output = [output, describeChanges(before, after)].filter(Boolean).join("\n\n");
      const found = compareResults(expected.verify, after, { ordered: true });
      if (found.length) problems.push(`After your statements, this check gave a different result:\n${job.verify.trim()}`, ...found);
    } catch (error) {
      problems.push(`After your statements, this check failed:\n${job.verify.trim()}`, error.message);
    }
  }
  if (!problems.length) {
    for (const statement of job.rejects ?? []) {
      try {
        await learner.exec(`BEGIN; ${statement}; ROLLBACK;`);
        problems.push(`This statement should be rejected after your change, but it succeeded:\n${statement}`);
        break;
      } catch {
        await learner.exec("ROLLBACK;").catch(() => {});
      }
    }
  }
  await learner.close();
  return problems.length ? { status: "mismatch", details: problems, output } : { status: "passed", details: [], output };
}
