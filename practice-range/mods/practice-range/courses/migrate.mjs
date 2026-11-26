// Explicit progress migration to a newer compatible content version. The old enrollment is never changed.
import { cp, mkdir, readFile, rename, rm, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/** The newer version declares which earlier versions it accepts, and any renamed exercise IDs. */
export function canMigrate(from, to) {
  return to.id === from.id && to.contentVersion !== from.contentVersion && Boolean(to.compatibility?.fromVersions?.includes(from.contentVersion));
}

const taskIds = pack => new Set([...pack.lessons.flatMap(lesson => lesson.tasks.map(task => task.id)), ...(pack.readiness ?? []).map(group => group.task.id)]);

/**
 * Map progress by exact ID or declared replacement. Unmatched IDs are retired, never credited.
 * A replacement with keepCompletion false keeps its history but asks for a fresh pass.
 */
export function migrateState(state, from, to, now = Date.now()) {
  if (state.review) throw new Error("Finish or end the course review before updating.");
  const replacements = new Map((to.compatibility.replacements ?? []).map(item => [item.from, item]));
  const available = taskIds(to), next = structuredClone(state), retired = { tasks: {}, modules: {} };
  next.contentVersion = to.contentVersion;
  next.tasks = {};
  for (const [id, progress] of Object.entries(state.tasks)) {
    const replacement = replacements.get(id), target = replacement?.to ?? id;
    if (!available.has(target) || next.tasks[target]) { retired.tasks[id] = progress; continue; }
    next.tasks[target] = replacement && replacement.keepCompletion === false
      ? { ...structuredClone(progress), passes: 0, independentPasses: 0, result: null, checkedHash: null, retake: { from: id, at: now } }
      : structuredClone(progress);
  }
  next.modules = {};
  for (const [id, progress] of Object.entries(state.modules)) {
    const lesson = to.lessons.find(lesson => lesson.id === id);
    if (!lesson) { retired.modules[id] = progress; continue; }
    const steps = lesson.steps.length;
    // Question results stay only where the question still exists. Others move to retired history.
    const questions = Object.fromEntries(Object.entries(progress.questions).filter(([questionId, result]) => {
      const question = lesson.questions.find(question => question.id === questionId);
      return question && question.choices[result.choice] && result.correct === (question.answer === result.choice);
    }));
    next.modules[id] = { ...structuredClone(progress), seen: progress.seen.filter(step => step < steps), questions,
      ...(Number.isInteger(progress.resumeStep) && progress.resumeStep >= steps ? { resumeStep: 0 } : {}) };
    if (Object.keys(questions).length !== Object.keys(progress.questions).length) retired.modules[id] = progress;
  }
  const position = state.position && to.lessons.find(lesson => lesson.id === state.position.moduleId);
  next.position = position && position.steps[state.position.step] ? state.position : null;
  const active = state.activeTask && (replacements.get(state.activeTask)?.to ?? state.activeTask);
  next.activeTask = active && next.tasks[active] ? active : null;
  if (Object.keys(retired.tasks).length || Object.keys(retired.modules).length) next.retired = { ...(state.retired ?? {}), [from.contentVersion]: retired };
  return next;
}

/** Called under the source enrollment lock. Publishes the new enrollment folder in one rename. */
export async function migrateEnrollment(source, target, state, from, to, { selection }) {
  if (!canMigrate(from, to)) throw new Error(`Version ${to.contentVersion} does not accept progress from ${from.contentVersion}. Start it separately instead.`);
  try { await stat(join(target, "enrollment.json")); throw new Error(`Version ${to.contentVersion} is already started. Resume it from Courses.`); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const next = migrateState(state, from, to);
  const staging = `${target}.update-${randomUUID()}`;
  await mkdir(staging, { recursive: true });
  try {
    // Answers and backups are copied whole, so removed exercises stay recoverable. Builds stay behind.
    for (const name of ["answers", "history", "extra-practice.json", "repo-lessons.json", "attachments.json"]) {
      try { await cp(join(source, name), join(staging, name), { recursive: true, filter: path => !/[\\/](node_modules|bin|obj|_reference)([\\/]|$)/.test(path) }); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    for (const item of to.compatibility.replacements ?? []) {
      const from = join(staging, "answers", item.from.split("/").at(-1)), into = join(staging, "answers", item.to.split("/").at(-1));
      try { await stat(into); } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await rename(from, into).catch(error => { if (error.code !== "ENOENT") throw error; });
      }
    }
    await writeFile(join(staging, "enrollment.json"), JSON.stringify(next, null, 2) + "\n");
    await writeFile(join(staging, "migration.json"), JSON.stringify({ version: 1, from: from.contentVersion, to: to.contentVersion, at: new Date().toISOString(),
      retiredTasks: Object.keys(next.retired?.[from.contentVersion]?.tasks ?? {}) }, null, 2) + "\n");
    await rm(target, { recursive: true, force: true });
    await rename(staging, target);
  } finally { await rm(staging, { recursive: true, force: true }); }
  const temporary = `${selection}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify({ courseId: to.id, contentVersion: to.contentVersion }, null, 2) + "\n");
  await rename(temporary, selection);
  return next;
}

export async function readMigration(directory) {
  try { return JSON.parse(await readFile(join(directory, "migration.json"), "utf8")); }
  catch { return null; }
}
