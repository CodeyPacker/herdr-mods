// Node owns files and child processes. The Herdr view only sends structured CLI arguments.
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, copyFile, stat, open, unlink, chmod } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { catalogFor } from "./catalog.js";
import { defaultLanguage, findLanguage } from "./languages/index.js";
import { loadLanguageRunner } from "./languages/runner.mjs";
import { setupStatus, checkRequirements, completeSetup, selectLanguage } from "./setup.mjs";
import { readyForReview, reviewSet } from "./review.js";

/** The same content saved again within this many milliseconds is one save, not a new attempt. */
const DUPLICATE_SAVE_MS = 3000;

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw new Error(`Cannot read ${path}: ${error.message}`); }
}

async function writeJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n");
  await rename(temporary, path);
}

async function writeIfChanged(path, content) {
  try { if (await readFile(path, "utf8") === content) return; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(path, content);
}

function emptyState(language) {
  return { version: 1, languageId: language.id, exerciseId: language.exercises[0].id, hintCount: 0, answerShown: false, progress: {}, result: null };
}

/** Each pack keeps its session, answers, backups, and checker files in its own directory. C# uses the root. */
export function languageRoot(root, language = defaultLanguage) {
  return join(root, language.dataDirectory);
}

export function exerciseFile(root, id, language = defaultLanguage) {
  catalogFor(language).findExercise(id); // Catalog IDs are the only allowed path components.
  return join(root, "answers", id, language.answerFile);
}

/** The reference answer, outside the answer folders so editor tooling never mixes it with yours. */
export function referenceFile(root, id, language = defaultLanguage) {
  catalogFor(language).findExercise(id);
  return join(root, "answers", "_reference", id, `Reference${language.fileExtension}`);
}

/**
 * Two answers are the same when only comments and whitespace differ. SQL also ignores the case
 * of everything outside string literals, so `select` matches `SELECT`.
 * @param {string} left @param {string} right @param {"sql" | string} codeFence
 */
export function sameAnswer(left, right, codeFence) {
  const sql = codeFence === "sql";
  const comment = sql ? /\/\*[\s\S]*?\*\/|--[^\n]*/g : /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  const normalize = text => {
    const code = text.replace(comment, "").replace(/\s+/g, "").replace(/;+$/, "");
    return sql ? code.split(/('(?:[^']|'')*')/).map((part, index) => index % 2 ? part : part.toLowerCase()).join("") : code;
  };
  return normalize(left) === normalize(right);
}

/** Write the reference read-only, so the diff can't be mistaken for something to edit. */
async function writeReference(file, solution) {
  await mkdir(dirname(file), { recursive: true });
  try { await chmod(file, 0o644); } catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(file, solution.endsWith("\n") ? solution : `${solution}\n`);
  await chmod(file, 0o444);
}

/** A review attempt gets its own blank file, so the saved answer stays untouched. */
export function reviewFile(root, id, language = defaultLanguage) {
  catalogFor(language).findExercise(id);
  return join(root, "answers", "_review", id, language.answerFile);
}

async function ensureExercise(root, exercise, language, runner, { review = false, fresh = false } = {}) {
  const file = review ? reviewFile(root, exercise.id, language) : exerciseFile(root, exercise.id, language);
  await mkdir(dirname(file), { recursive: true });
  if (fresh) await writeFile(file, runner.createAnswer(exercise));
  try { await writeFile(file, runner.createAnswer(exercise), { flag: "wx" }); } catch (error) { if (error.code !== "EEXIST") throw error; }
  const existing = await readFile(file, "utf8");
  const migrated = review ? null : runner.migrateAnswer(exercise, existing);
  if (migrated !== null) {
    const backup = join(root, "history", exercise.id);
    await mkdir(backup, { recursive: true });
    await copyFile(file, join(backup, `${Date.now()}-${randomUUID()}-before-migration${language.fileExtension}`));
    await writeFile(file, migrated);
  }
  const declarations = exercise.declarations ? `\n${exercise.declarations}` : "";
  await writeIfChanged(join(dirname(file), "README.md"), `# ${exercise.title}\n\n${exercise.prompt}\n\nWrite your answer in ${language.answerFile}. You can replace the entire file. Saving checks your code automatically while the Practice Range tab is open. ${language.checkNote ?? "Imports, surrounding code, and supplied types are added when checking."}${declarations ? `\n\n${language.suppliedLabel ?? "Supplied types"}:\n\n\`\`\`${language.codeFence}\n${declarations.trim()}\n\`\`\`` : ""}\n`);
  return file;
}

/** The scratch file sits beside the answers, so the editor and save watcher treat it like one. */
export function scratchFile(root, language = defaultLanguage) {
  return join(root, "answers", "_scratch", `Scratch${language.fileExtension}`);
}

async function ensureScratch(root, language, runner) {
  const file = scratchFile(root, language);
  await mkdir(dirname(file), { recursive: true });
  try { await writeFile(file, runner.scratchStarter(), { flag: "wx" }); } catch (error) { if (error.code !== "EEXIST") throw error; }
  return file;
}

/** Show the next review exercise with no hints, no answer, and no earlier result. */
function startReviewItem(state) {
  state.exerciseId = state.review.ids[state.review.index];
  state.hintCount = 0; state.answerShown = false; state.result = null;
}

/** Leave a review: summarize it and go back to the exercise you were on. */
function endReview(state) {
  const { ids, outcomes, returnTo } = state.review;
  const results = ids.map(id => outcomes[id]);
  state.lastReview = {
    at: Date.now(), total: ids.length, clean: results.filter(item => item?.clean).length,
    retried: results.filter(item => item?.passed && !item.clean).length, missed: results.filter(item => !item?.passed).length,
  };
  Object.assign(state, returnTo);
  state.review = null;
}

/** One command holds an exclusive lock so two panels cannot overwrite each other's progress. */
export async function command(root, action, value) {
  root = resolve(root);
  await mkdir(root, { recursive: true });
  if (action === "setup-status") return setupStatus(root);
  if (action === "setup-check" || action === "setup-complete") {
    // Already-open tabs can still send the editor name from before language selection.
    const options = value === "neovim" || value === "vscode" ? { editor: value } : value ? JSON.parse(value) : {};
    const { editor = null, languageId = defaultLanguage.id } = options;
    return action === "setup-check" ? checkRequirements(editor, { languageId }) : completeSetup(root, editor, languageId);
  }
  const lock = join(root, "session.lock");
  let handle;
  try { handle = await open(lock, "wx"); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    const age = Date.now() - (await stat(lock)).mtimeMs;
    if (age < 180000) throw new Error("Another Practice Range action is running. Try again in a moment.");
    await unlink(lock);
    return command(root, action, value);
  }
  try {
    // The active pack comes from setup. Sessions saved before language packs belong to C#.
    const active = action === "language" ? await selectLanguage(root, value) : await setupStatus(root);
    const language = findLanguage(active.languageId);
    const base = languageRoot(root, language);
    await mkdir(base, { recursive: true });
    const state = await readJson(join(base, "session.json"), emptyState(language));
    if ((state.languageId ?? defaultLanguage.id) !== language.id) throw new Error(`${join(base, "session.json")} belongs to another language.`);
    const { findExercise, topicExercises } = catalogFor(language);
    state.languageId = language.id;
    const runner = await loadLanguageRunner(language.id);
    findExercise(state.exerciseId);
    const exercise = findExercise(state.exerciseId);
    /** @type {{ answerFile: string, referenceFile: string, same: boolean } | null} */
    let compare = null;
    // Choosing an exercise or a language ends a review first, restoring where you were.
    if (state.review && ["select", "language", "review-end"].includes(action)) endReview(state);
    // Scratch mode swaps the editable file for a free-form one. Choosing an exercise leaves it.
    if (["select", "next", "language", "practice", "review-start", "review-end"].includes(action)) state.scratch = false;
    if (action === "review-start") {
      const ready = readyForReview(catalogFor(language), state.progress, exercise.topicId, Date.now());
      const ids = reviewSet(ready);
      if (!ids.length) throw new Error("Nothing is ready for review yet. Review uses topics you've practiced, other than the one you're on.");
      state.review = { ids, index: 0, outcomes: {}, returnTo: { exerciseId: state.exerciseId, hintCount: state.hintCount, answerShown: state.answerShown, result: state.result } };
      state.lastReview = null;
      startReviewItem(state);
      await ensureExercise(base, findExercise(state.exerciseId), language, runner, { review: true, fresh: true });
    } else if (action === "review-end") {
      // endReview already restored the exercise.
    } else if (action === "next" && state.review) {
      state.review.index++;
      if (state.review.index >= state.review.ids.length) endReview(state);
      else {
        startReviewItem(state);
        await ensureExercise(base, findExercise(state.exerciseId), language, runner, { review: true, fresh: true });
      }
    } else if (action === "compare") {
      // Only after a pass: comparing is for learning another approach, not for finding the answer.
      if (!state.result?.passed) throw new Error("Pass the exercise first. Then you can compare your answer with the reference.");
      const answerFile = await ensureExercise(base, exercise, language, runner, { review: Boolean(state.review) });
      const answer = (await readFile(answerFile, "utf8")).replaceAll("\r\n", "\n");
      const file = referenceFile(base, exercise.id, language);
      await writeReference(file, exercise.solution);
      compare = { answerFile, referenceFile: file, same: sameAnswer(answer, exercise.solution, language.codeFence) };
    } else if (action === "send-to-scratch") {
      if (!runner.runScratch) throw new Error(`Scratch isn't available for ${language.name} yet.`);
      const answer = (await readFile(await ensureExercise(base, exercise, language, runner, { review: Boolean(state.review) }), "utf8")).replaceAll("\r\n", "\n");
      const file = await ensureScratch(base, language, runner);
      const previous = await readFile(file, "utf8");
      if (previous !== runner.scratchStarter()) {
        const backup = join(base, "history", "_scratch");
        await mkdir(backup, { recursive: true });
        await copyFile(file, join(backup, `${Date.now()}-${randomUUID()}${language.fileExtension}`));
      }
      const submitted = runner.scratchFromAnswer ? runner.scratchFromAnswer(exercise, answer) : answer;
      await writeFile(file, submitted);
      state.scratch = true;
      state.scratchResult = { ...await runner.runScratch(base, submitted), at: Date.now(), sourceHash: createHash("sha256").update(submitted).digest("hex") };
    } else if (action === "scratch") {
      if (!runner.runScratch) throw new Error(`Scratch isn't available for ${language.name} yet.`);
      state.scratch = true;
    } else if (action === "practice") {
      // Back to the current exercise. The scratch file and its last run are kept.
    } else if (state.scratch && (action === "check" || action === "check-saved")) {
      const file = await ensureScratch(base, language, runner);
      const submitted = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
      const sourceHash = createHash("sha256").update(submitted).digest("hex");
      // Run on an explicit request, or on a save that changed the file. Runs never count as attempts.
      if (action === "check" || sourceHash !== (state.scratchResult?.sourceHash ?? JSON.parse(value).sourceHash)) {
        state.scratchResult = { ...await runner.runScratch(base, submitted), at: Date.now(), sourceHash };
      }
    } else if (action === "select") {
      const next = findExercise(value);
      state.exerciseId = next.id;
      state.hintCount = 0; state.answerShown = false; state.result = null;
    } else if (action === "next") {
      const items = topicExercises(exercise.topicId);
      state.exerciseId = items[(items.findIndex(item => item.id === exercise.id) + 1) % items.length].id;
      state.hintCount = 0; state.answerShown = false; state.result = null;
    } else if (action === "hint") {
      state.hintCount = Math.min(exercise.hints.length, state.hintCount + 1);
    } else if (action === "answer") {
      state.answerShown = true;
    } else if (action === "repeat" && state.review) {
      await ensureExercise(base, exercise, language, runner, { review: true, fresh: true });
      state.hintCount = 0; state.answerShown = false; state.result = null;
    } else if (action === "repeat") {
      const file = await ensureExercise(base, exercise, language, runner);
      const backup = join(base, "history", exercise.id);
      await mkdir(backup, { recursive: true });
      await copyFile(file, join(backup, `${Date.now()}-${randomUUID()}${language.fileExtension}`));
      await writeFile(file, runner.createAnswer(exercise));
      state.hintCount = 0; state.answerShown = false; state.result = null;
    } else if (action === "check" || action === "check-saved") {
      const saved = action === "check-saved" ? JSON.parse(value) : null;
      const file = await ensureExercise(base, exercise, language, runner, { review: Boolean(state.review) });
      const submitted = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
      const sourceHash = createHash("sha256").update(submitted).digest("hex");
      // Every save checks, even an answer that already passed. Skipped: saves for a previous
      // exercise, an untouched starter file, and the same content again within a few seconds,
      // since one save can arrive as several notifications.
      const starter = runner.createAnswer(exercise).replaceAll("\r\n", "\n");
      const duplicate = state.result?.sourceHash === sourceHash && Date.now() - (state.result?.at ?? 0) < DUPLICATE_SAVE_MS;
      const shouldCheck = action === "check" || ((saved.languageId ?? defaultLanguage.id) === language.id && saved.exerciseId === exercise.id
        && submitted !== starter && !duplicate);
      if (shouldCheck) {
        const result = await runner.check(base, exercise, submitted);
        state.result = { ...result, at: Date.now(), sourceHash, assisted: state.answerShown };
        const progress = state.progress[exercise.id] ?? { attempts: 0, passes: 0, independentPasses: 0 };
        const checksBefore = state.review?.outcomes[exercise.id]?.checks ?? 0;
        progress.attempts++;
        progress.last = Date.now();
        if (result.passed) { progress.passes++; if (!state.answerShown) progress.independentPasses++; }
        // A wrong answer marks the exercise unsolved again, even if it passed before.
        else { progress.passes = 0; progress.independentPasses = 0; }
        if (state.review) {
          // Only a first-try pass without hints or the answer counts as remembered.
          const clean = result.passed && checksBefore === 0 && state.hintCount === 0 && !state.answerShown;
          const outcome = state.review.outcomes[exercise.id] ?? { checks: 0, passed: false, clean: false };
          outcome.checks++;
          if (result.passed && !outcome.passed) {
            outcome.passed = true;
            outcome.clean = clean;
            progress.review = { streak: clean ? (progress.review?.streak ?? 0) + 1 : 0, at: Date.now() };
          } else if (!result.passed && checksBefore === 0) progress.review = { streak: 0, at: Date.now() };
          state.review.outcomes[exercise.id] = outcome;
        } else if (result.passed && state.hintCount > 0) progress.hinted = true;
        state.progress[exercise.id] = progress;
      }
    } else if (action !== "status" && action !== "language") throw new Error(`Unknown action: ${action}`);
    if (state.scratch && !runner.runScratch) state.scratch = false;
    const current = findExercise(state.exerciseId);
    const answer = await ensureExercise(base, current, language, runner, { review: Boolean(state.review) });
    const file = state.scratch ? await ensureScratch(base, language, runner) : answer;
    const runtime = await runner.environment();
    // Scratch code gets the editor files of an exercise that supplies nothing.
    await runner.prepareWorkspace(file, runtime, state.scratch ? { id: "scratch", checks: [], rules: [] } : current);
    const source = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
    const sourceHash = createHash("sha256").update(source).digest("hex");
    const shown = state.scratch ? state.scratchResult : state.result;
    const stale = shown && shown.sourceHash !== sourceHash;
    await writeJson(join(base, "session.json"), state);
    // Counted fresh each time, from the topic you're on outside the review.
    const pathTopic = findExercise(state.review?.returnTo.exerciseId ?? state.exerciseId).topicId;
    const reviewReady = readyForReview(catalogFor(language), state.progress, pathTopic, Date.now()).length;
    return { ...state, file, folder: dirname(file), root: base, runtimeVersion: runtime.version, stale: Boolean(stale), sourceHash, reviewReady, compare };
  } finally {
    await handle.close();
    await unlink(lock);
  }
}

// Herdr installations may symlink the mod directory. Node resolves import.meta.url to
// the real file, while argv keeps the installed path. Compare the resolved files.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [root, action = "status", value] = process.argv.slice(2);
  try {
    if (!root) throw new Error("Usage: node runner.mjs <practice-directory> <status|select|next|hint|answer|repeat|check|language|scratch|practice|send-to-scratch|review-start|review-end|compare> [exercise-id|language-id]");
    console.log(JSON.stringify(await command(root, action, value)));
  } catch (error) { console.log(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}
