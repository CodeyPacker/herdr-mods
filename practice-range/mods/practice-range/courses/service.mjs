// Course commands never change the direct-practice session or its answer files.
import { readFile, writeFile, mkdir, rename, unlink, open, copyFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { loadCourse, listCourses, lessonFor, taskFor } from "./loader.mjs";
import { findLanguage } from "../languages/index.js";
import { loadLanguageRunner } from "../languages/runner.mjs";
import { courseReview, nextCourseAction } from "./review.js";

const hash = source => createHash("sha256").update(typeof source === "string" ? source : JSON.stringify(source)).digest("hex");
export const enrollmentDirectory = (root, pack) => join(root, "courses", encodeURIComponent(pack.id), pack.contentVersion);
const answerPath = (directory, task, language, review) => join(directory, "answers", ...(review ? ["_review", review.id] : []), task.id.split("/").at(-1), task.workspace?.editable[0].file ?? language.answerFile);
const newTaskProgress = () => ({ attempts: 0, passes: 0, independentPasses: 0, hintCount: 0, answerShown: false, history: [] });
const taskProgress = (state, id) => state.review ? state.review.progress : state.tasks[id];
const starters = task => task.workspace ? Object.fromEntries(task.workspace.editable.map(file => [file.file, file.starter])) : task.starter;
async function readAnswer(file, task) {
  if (!task.workspace) return readFile(file, "utf8");
  const files = {};
  for (const editable of task.workspace.editable) files[editable.file] = await readFile(join(dirname(file), editable.file), "utf8");
  return files;
}
async function writeStarters(file, task, createOnly = false) {
  const files = task.workspace ? task.workspace.editable : [{ file: file.split(/[\\/]/).at(-1), starter: task.starter }];
  for (const editable of files) {
    try { await writeFile(join(dirname(file), editable.file), editable.starter, createOnly ? { flag: "wx" } : {}); }
    catch (error) { if (!createOnly || error.code !== "EEXIST") throw error; }
  }
}
async function readJson(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw new Error(`Cannot read course progress: ${error.message}`); }
}
async function save(file, data) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(data, null, 2) + "\n"); await rename(temporary, file); }
  finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}
async function locked(directory, run) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, "course.lock");
  let handle;
  try { handle = await open(path, "wx"); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    // Every course check is bounded by the bridge timeout. Recover locks left by a killed CLI.
    if (Date.now() - (await stat(path)).mtimeMs > 10 * 60 * 1000) {
      await unlink(path);
      return locked(directory, run);
    }
    throw new Error("Another course action is running. Retry when it finishes. An interrupted action unlocks after ten minutes.");
  }
  try { return await run(); }
  finally { await handle.close(); await unlink(path); }
}
function fresh(pack, entryPath) {
  if (!pack.entryPaths.some(path => path.id === entryPath)) throw new Error("Unknown course entry path.");
  return { version: 1, courseId: pack.id, contentVersion: pack.contentVersion, entryPath,
    position: null, activeTask: null, review: null, modules: {}, tasks: {} };
}
function validateState(state, pack) {
  const record = value => value && typeof value === "object" && !Array.isArray(value);
  if (state.version !== 1 || state.courseId !== pack.id || state.contentVersion !== pack.contentVersion ||
      !record(state.modules) || !record(state.tasks) || !pack.entryPaths.some(path => path.id === state.entryPath)) {
    throw new Error("Course progress is incompatible or damaged. The saved file has been preserved.");
  }
  if (state.position) {
    const lesson = lessonFor(pack, state.position.moduleId);
    if (!Number.isInteger(state.position.step) || !lesson.steps[state.position.step]) throw new Error("The saved lesson position is damaged. Course progress has been preserved.");
  }
  for (const [id, progress] of Object.entries(state.modules)) {
    const lesson = lessonFor(pack, id);
    if (!record(progress) || !Array.isArray(progress.seen) || !record(progress.questions) ||
        !progress.seen.every(step => Number.isInteger(step) && lesson.steps[step])) throw new Error("Saved lesson progress is damaged. The saved file has been preserved.");
    for (const [questionId, result] of Object.entries(progress.questions)) {
      const question = lesson.questions.find(question => question.id === questionId);
      if (!question || !record(result) || !Number.isInteger(result.choice) || !question.choices[result.choice] ||
          result.correct !== (question.answer === result.choice)) throw new Error("Saved question progress is damaged. The saved file has been preserved.");
    }
  }
  for (const [id, progress] of Object.entries(state.tasks)) {
    taskFor(pack, id);
    if (!record(progress) || !Array.isArray(progress.history) ||
        ![progress.attempts, progress.passes, progress.independentPasses, progress.hintCount].every(n => Number.isInteger(n) && n >= 0)) {
      throw new Error("Saved exercise progress is damaged. The saved file has been preserved.");
    }
  }
  if (state.activeTask && !Object.hasOwn(state.tasks, state.activeTask)) throw new Error("The saved exercise selection is damaged. Course progress has been preserved.");
  if (state.review && (!/^[a-f0-9-]{36}$/.test(state.review.id) || !Array.isArray(state.review.ids) ||
      !Number.isInteger(state.review.index) || state.review.ids[state.review.index] !== state.activeTask || !record(state.review.progress))) {
    throw new Error("The saved review is damaged. Course progress has been preserved.");
  }
}
async function runnerFor(pack) {
  const runner = await loadLanguageRunner(pack.languageId);
  const runtime = await runner.environment();
  const expected = pack.runner.compiler.range.slice(1);
  if (!runtime.version.endsWith(` ${expected}`)) throw new Error(`This course needs ${pack.runner.compiler.name} ${expected}. ${runtime.version} is installed.`);
  return { runner, runtime };
}

async function prepareTask(directory, pack, task, state) {
  const language = findLanguage(pack.languageId), { runner, runtime } = await runnerFor(pack);
  const file = answerPath(directory, task, language, state.review);
  await mkdir(dirname(file), { recursive: true });
  await writeStarters(file, task, true);
  await runner.prepareWorkspace(file, runtime, { ...task, declarations: task.fixtures[0].declarations });
  return file;
}

function endReview(state) {
  const back = state.review.returnTo;
  state.activeTask = back.activeTask;
  state.position = back.position;
  state.review = null;
}
function reviewOutcome(state) {
  const progress = state.review.progress, canonical = state.tasks[state.activeTask];
  const clean = progress.result?.passed && progress.attempts === 1 && !progress.result.assisted;
  canonical.review = { at: Date.now(), streak: clean ? (canonical.review?.streak ?? 0) + 1 : 0 };
}

/** Every fixture checks the same source snapshot. The caller records just one attempt. */
export async function checkTask(root, pack, task, source, run) {
  const runner = run ?? (await runnerFor(pack)).runner.check;
  const fixtures = [];
  for (const fixture of task.fixtures) {
    const { fixtures: _fixtures, ...exercise } = task;
    const result = await runner(root, { ...exercise, declarations: fixture.declarations,
      modules: { ...task.modules, ...(task.workspace ? source : {}) } }, task.workspace ? task.workspace.entry : source);
    fixtures.push({ id: fixture.id, ...result, details: result.details.map(detail => {
      const match = detail.match(/^Check (\d+) failed:/);
      const label = match && task.checkLabels?.[Number(match[1]) - 1];
      return label ? `Check ${match[1]} failed: ${label}` : detail;
    }) });
  }
  const passed = fixtures.every(result => result.passed);
  return { passed, kind: passed ? "pass" : "course", title: passed ? "All cases passed" : "Some cases need a correction",
    details: fixtures.flatMap(result => result.passed ? [] : [`Case ${result.id}: ${result.title}`, ...result.details]), fixtures };
}

export async function courseCommand(root, action, request = {}) {
  if (action === "list") return { courses: await listCourses() };
  const pack = await loadCourse(request.courseId);
  const directory = enrollmentDirectory(root, pack), file = join(directory, "enrollment.json");
  return locked(directory, async () => {
    let state = await readJson(file);
    if (!state) {
      if (action !== "enroll") throw new Error("Start this course before saving progress.");
      state = fresh(pack, request.entryPath ?? "beginner");
    }
    validateState(state, pack);
    const persist = async () => { await save(file, state); };
    if (action === "enroll") await persist();
    else if (["review-start", "review-next", "review-end"].includes(action)) {
      if (action === "review-start" && !state.review) {
        const ids = courseReview(pack, state, Date.now()).ids;
        if (!ids.length) throw new Error("No course exercises are due for review yet.");
        state.review = { id: randomUUID(), ids, index: 0, returnTo: { position: state.position, activeTask: state.activeTask }, progress: newTaskProgress() };
        state.activeTask = ids[0];
      } else if (!state.review) throw new Error("No course review is running.");
      if (action === "review-next") {
        reviewOutcome(state);
        state.review.index++;
        if (state.review.index === state.review.ids.length) endReview(state);
        else { state.activeTask = state.review.ids[state.review.index]; state.review.progress = newTaskProgress(); }
      }
      if (action === "review-end") { if (state.review.progress.attempts) reviewOutcome(state); endReview(state); }
      if (state.review) {
        const { task } = taskFor(pack, state.activeTask);
        await prepareTask(directory, pack, task, state);
        state.review.progress.initialHash ??= hash(starters(task));
      }
      await persist();
    } else if (action === "open") {
      if (state.review) throw new Error("End or finish your review before opening a lesson.");
      const lesson = lessonFor(pack, request.moduleId);
      const step = request.step ?? 0;
      if (!Number.isInteger(step) || !lesson.steps[step]) throw new Error("Unknown lesson step.");
      state.position = { moduleId: lesson.id, step };
      state.activeTask = null;
      await persist();
    } else if (["seen", "question", "skip"].includes(action)) {
      const lesson = lessonFor(pack, request.moduleId);
      const progress = state.modules[lesson.id] ??= { seen: [], questions: {} };
      if (action === "skip") progress.skipped = !progress.skipped;
      else if (action === "seen") {
        if (!Number.isInteger(request.step) || !lesson.steps[request.step]) throw new Error("Unknown lesson step.");
        progress.seen = [...new Set([...progress.seen, request.step])].sort((a, b) => a - b);
      } else {
        const question = lesson.questions.find(question => question.id === request.questionId);
        if (!question || !Number.isInteger(request.choice) || !question.choices[request.choice]) throw new Error("Unknown question or choice.");
        const previous = progress.questions[question.id];
        progress.questions[question.id] = { choice: request.choice, correct: question.answer === request.choice,
          attempts: (previous?.attempts ?? 0) + 1, at: Date.now() };
      }
      await persist();
    } else if (["task", "check", "check-saved", "hint", "answer", "reset"].includes(action)) {
      const { task, lesson } = taskFor(pack, request.taskId);
      if (state.review && action === "task") throw new Error("End or finish your review before choosing another exercise.");
      const language = findLanguage(pack.languageId), answer = answerPath(directory, task, language, state.review);
      state.tasks[task.id] ??= newTaskProgress();
      const progress = taskProgress(state, task.id);
      if (action !== "task" && state.activeTask !== task.id) throw new Error("This exercise is no longer selected. Reopen it before checking.");
      if (action === "task") {
        await prepareTask(directory, pack, task, state);
        state.activeTask = task.id;
        // Entering an exercise retains the lesson position for Return to lesson.
        if (state.position?.moduleId !== lesson.id) state.position = { moduleId: lesson.id, step: 0 };
        progress.initialHash ??= hash(starters(task));
      } else if (action === "hint") progress.hintCount = Math.min(task.hints.length, progress.hintCount + 1);
      else if (action === "answer") progress.answerShown = true;
      else if (action === "reset") {
        const backup = join(directory, "history", task.id.split("/").at(-1));
        await mkdir(backup, { recursive: true });
        const stamp = `${Date.now()}-${randomUUID()}`;
        if (task.workspace) {
          await mkdir(join(backup, stamp));
          for (const editable of task.workspace.editable) await copyFile(join(dirname(answer), editable.file), join(backup, stamp, editable.file));
        } else await copyFile(answer, join(backup, `${stamp}${language.fileExtension}`));
        await writeStarters(answer, task);
        progress.hintCount = 0; progress.answerShown = false; progress.result = null; progress.checkedHash = null;
        progress.initialHash = hash(starters(task));
      } else {
        const source = await readAnswer(answer, task), sourceHash = hash(source);
        const duplicate = progress.checkedHash === sourceHash;
        if (!duplicate && !(action === "check-saved" && !progress.checkedHash && sourceHash === progress.initialHash)) {
          const checks = join(directory, "checks");
          await mkdir(checks, { recursive: true });
          const result = await checkTask(checks, pack, task, source);
          const currentHash = hash(await readAnswer(answer, task));
          // A newer save will be checked next. Never record a stale verdict as a current pass.
          if (currentHash !== sourceHash) return { ...await snapshot(pack, state, directory), pendingSave: true };
          const assisted = progress.hintCount > 0 || progress.answerShown;
          const attempt = { at: Date.now(), sourceHash, passed: result.passed, assisted,
            hintCount: progress.hintCount, answerShown: progress.answerShown };
          progress.attempts++; if (result.passed) progress.passes++;
          if (result.passed && !assisted) progress.independentPasses++;
          progress.history.push(attempt);
          if (state.review) {
            const canonical = state.tasks[task.id];
            canonical.attempts++; if (result.passed) canonical.passes++;
            if (result.passed && !assisted) canonical.independentPasses++;
            canonical.history.push({ ...attempt, review: true });
          }
          progress.checkedHash = sourceHash;
          progress.result = { ...result, ...attempt };
        }
      }
      await persist();
    } else if (action !== "status") throw new Error(`Unknown course action: ${action}`);
    return snapshot(pack, state, directory);
  });
}

async function snapshot(pack, state, directory) {
  const active = state.activeTask ? taskFor(pack, state.activeTask).task : null;
  const language = findLanguage(pack.languageId);
  const file = active ? answerPath(directory, active, language, state.review) : null;
  const progress = active ? taskProgress(state, active.id) : null;
  // Reference content is returned only after an explicit reveal. Checks stay in the Node process.
  const lessons = pack.lessons.map(lesson => ({ ...lesson, tasks: lesson.tasks.map(task => ({
    id: task.id, title: task.title, prompt: task.prompt, role: task.role, feedback: task.feedback,
    fixtures: task.fixtures.map(fixture => ({ id: fixture.id, declarations: fixture.declarations })),
    hints: task.id === active?.id ? task.hints.slice(0, progress.hintCount) : [],
    solution: task.id === active?.id && progress.answerShown ? task.solution : null,
    ...(task.workspace ? { workspace: { editable: task.workspace.editable.map(file => ({ file: file.file,
      solution: task.id === active?.id && progress.answerShown ? file.solution : null })) } } : {}),
  })) }));
  const sourceHash = file ? hash(await readAnswer(file, active)) : null;
  return { course: { id: pack.id, title: pack.title, contentVersion: pack.contentVersion, languageId: pack.languageId,
    preview: pack.preview === true, modules: pack.modules, lessons },
    enrollment: state.review && active ? { ...state, tasks: { ...state.tasks, [active.id]: progress } } : state,
    reviewReady: courseReview(pack, state, Date.now()).ids.length, recommendation: nextCourseAction(pack, state, Date.now()),
    file, folder: file ? dirname(file) : null, sourceHash,
    stale: Boolean(progress?.result && progress.result.sourceHash !== sourceHash) };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const [root, action, value] = process.argv.slice(2);
    if (!root || !action) throw new Error("Usage: node courses/service.mjs <practice folder> <action> [request JSON]");
    process.stdout.write(JSON.stringify(await courseCommand(root, action, value ? JSON.parse(value) : {})));
  } catch (error) { process.stdout.write(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}
