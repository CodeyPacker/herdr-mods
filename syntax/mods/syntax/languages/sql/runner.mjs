import { mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { runProcess } from "../../process.mjs";
import { datasetSql } from "./dataset.js";
import { ruleFailures, isBlank } from "./lexer.js";

export const packDirectory = dirname(fileURLToPath(import.meta.url));
const engine = join(packDirectory, "engine.mjs");

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function writeIfChanged(path, content) {
  try { if (await readFile(path, "utf8") === content) return; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(path, content);
}

export async function pinnedVersion() {
  return JSON.parse(await readFile(join(packDirectory, "package.json"), "utf8")).dependencies["@electric-sql/pglite"];
}

export async function installedVersion() {
  try { return JSON.parse(await readFile(join(packDirectory, "node_modules", "@electric-sql", "pglite", "package.json"), "utf8")).version; }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export function installMessage(version) {
  return `Install this pack's database engine, PGlite ${version}: run npm ci in ${packDirectory}, then recheck. `
    + "npm downloads it from its registry once. It is PostgreSQL compiled to WebAssembly, so no database server is needed. Checks never download packages.";
}

export function createAnswer(exercise) {
  const starter = exercise.starter.trimStart();
  return starter.endsWith("\n") ? starter : `${starter}\n`;
}

// SQL answers are plain files. Existing files are never rewritten.
export function migrateAnswer() { return null; }

export async function environment() {
  const node = process.versions.node;
  if (Number(node.split(".")[0]) < 20) throw new Error(`SQL checks run on Node.js 20 or newer. This is Node.js ${node}.`);
  const version = await pinnedVersion();
  if (await installedVersion() !== version) throw new Error(installMessage(version));
  return { version: `PGlite ${version} (PostgreSQL 18)` };
}

/** schema.sql beside each answer shows every table and row the checks start from. */
export async function prepareWorkspace(file, _runtime, exercise) {
  const folder = dirname(file);
  await writeIfChanged(join(folder, "schema.sql"), datasetSql());
  if (exercise.setup) await writeIfChanged(join(folder, "setup.sql"), `-- Runs after schema.sql for this exercise only.\n${exercise.setup.trim()}\n`);
}

export async function check(root, exercise, answer) {
  return checkAnswer(root, exercise, answer);
}

/** Cached seeded database, keyed by the dataset and the engine version. */
async function snapshotPath(root) {
  const hash = createHash("sha256").update(datasetSql()).update(await pinnedVersion()).digest("hex").slice(0, 16);
  return join(root, "cache", `dataset-${hash}.tar`);
}

/** Run the reference answer and the learner's answer on fresh copies of the dataset, in another process. */
export async function checkAnswer(root, exercise, answer, { timeout } = {}) {
  if (isBlank(answer)) return { passed: false, kind: "syntax", title: "Write your SQL", details: [`Exercise.sql has no SQL yet. Write your answer below the comment and save.`] };
  const version = await pinnedVersion();
  if (await installedVersion() !== version) throw new Error(installMessage(version));
  const directory = join(root, "checks", randomUUID());
  await mkdir(directory, { recursive: true });
  try {
    const snapshot = await snapshotPath(root);
    const job = {
      snapshot, setup: exercise.setup ?? "", solution: exercise.solution, answer,
      verify: exercise.verify ?? "", rejects: exercise.rejects ?? [], ordered: Boolean(exercise.ordered),
      compareResult: exercise.result ?? !exercise.verify,
    };
    await writeFile(join(directory, "job.json"), JSON.stringify(job));
    const token = randomUUID();
    // The first check builds the dataset snapshot, which takes a few seconds longer.
    const limit = timeout ?? (await exists(snapshot) ? 8000 : 30000);
    const executed = await runProcess(process.execPath, [engine, join(directory, "job.json")], { cwd: directory, timeout: limit, env: { SYNTAX_CHECK_TOKEN: token } });
    if (executed.problem) return { passed: false, kind: "runtime", title: "The query could not finish", details: [executed.problem.replace("The code", "The query").replace("an infinite loop or waiting input", "a recursive query without a stopping condition, or a huge join")] };
    const output = executed.stdout.trimEnd();
    if (executed.code !== 0 || !output.endsWith(token)) {
      throw new Error(`The SQL checker stopped unexpectedly.\n${executed.stderr.trim().split("\n").slice(0, 6).join("\n")}`);
    }
    const outcome = JSON.parse(output.slice(0, -token.length).trim());
    if (outcome.status === "error") return { passed: false, kind: "compile", title: "Fix the SQL error", details: outcome.details };
    const missing = ruleFailures(answer, exercise.rules);
    // What the answer returned goes last, so the explanation of what to fix stays on top.
    const shown = outcome.output ? [outcome.output] : [];
    if (missing.length) return { passed: false, kind: "syntax", title: "Use the requested syntax", details: [...missing, ...shown] };
    if (outcome.status === "mismatch") return { passed: false, kind: "result", title: "The result needs a correction", details: [...outcome.details, ...shown] };
    return { passed: true, kind: "passed", title: "Correct. Stay here or try another exercise.", details: shown };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
