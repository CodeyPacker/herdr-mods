// Node owns files and child processes. The Herdr view only sends structured CLI arguments.
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, copyFile, stat, open, unlink } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { catalogFor } from "./catalog.js";
import { defaultLanguage, findLanguage } from "./languages/index.js";
import { loadLanguageRunner } from "./languages/runner.mjs";
import { setupStatus, checkRequirements, completeSetup, selectLanguage } from "./setup.mjs";

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

async function ensureExercise(root, exercise, language, runner) {
  const file = exerciseFile(root, exercise.id, language);
  await mkdir(dirname(file), { recursive: true });
  try { await writeFile(file, runner.createAnswer(exercise), { flag: "wx" }); } catch (error) { if (error.code !== "EEXIST") throw error; }
  const existing = await readFile(file, "utf8");
  const migrated = runner.migrateAnswer(exercise, existing);
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
    // Scratch mode swaps the editable file for a free-form one. Choosing an exercise leaves it.
    if (["select", "next", "language", "practice"].includes(action)) state.scratch = false;
    if (action === "scratch") {
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
    } else if (action === "repeat") {
      const file = await ensureExercise(base, exercise, language, runner);
      const backup = join(base, "history", exercise.id);
      await mkdir(backup, { recursive: true });
      await copyFile(file, join(backup, `${Date.now()}-${randomUUID()}${language.fileExtension}`));
      await writeFile(file, runner.createAnswer(exercise));
      state.hintCount = 0; state.answerShown = false; state.result = null;
    } else if (action === "check" || action === "check-saved") {
      const saved = action === "check-saved" ? JSON.parse(value) : null;
      const file = await ensureExercise(base, exercise, language, runner);
      const submitted = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
      const sourceHash = createHash("sha256").update(submitted).digest("hex");
      // Ignore duplicate notifications, generated starter files, and saves for a previous exercise.
      const shouldCheck = action === "check" || ((saved.languageId ?? defaultLanguage.id) === language.id && saved.exerciseId === exercise.id
        && sourceHash !== (state.result?.sourceHash ?? saved.sourceHash));
      if (shouldCheck) {
        const result = await runner.check(base, exercise, submitted);
        state.result = { ...result, at: Date.now(), sourceHash, assisted: state.answerShown };
        const progress = state.progress[exercise.id] ?? { attempts: 0, passes: 0, independentPasses: 0 };
        progress.attempts++;
        if (result.passed) { progress.passes++; if (!state.answerShown) progress.independentPasses++; }
        state.progress[exercise.id] = progress;
      }
    } else if (action !== "status" && action !== "language") throw new Error(`Unknown action: ${action}`);
    if (state.scratch && !runner.runScratch) state.scratch = false;
    const current = findExercise(state.exerciseId);
    await ensureExercise(base, current, language, runner);
    const file = state.scratch ? await ensureScratch(base, language, runner) : exerciseFile(base, current.id, language);
    const runtime = await runner.environment();
    // Scratch code gets the editor files of an exercise that supplies nothing.
    await runner.prepareWorkspace(file, runtime, state.scratch ? { id: "scratch", checks: [], rules: [] } : current);
    const source = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
    const sourceHash = createHash("sha256").update(source).digest("hex");
    const shown = state.scratch ? state.scratchResult : state.result;
    const stale = shown && shown.sourceHash !== sourceHash;
    await writeJson(join(base, "session.json"), state);
    return { ...state, file, folder: dirname(file), root: base, runtimeVersion: runtime.version, stale: Boolean(stale), sourceHash };
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
    if (!root) throw new Error("Usage: node runner.mjs <practice-directory> <status|select|next|hint|answer|repeat|check|language|scratch|practice> [exercise-id|language-id]");
    console.log(JSON.stringify(await command(root, action, value)));
  } catch (error) { console.log(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}
