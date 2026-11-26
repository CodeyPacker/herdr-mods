// Optional AI-written practice for bundled courses. Shipped packs stay unchanged: extras live in the
// learner's enrollment, are validated before saving, and never count toward module evidence or review.
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { validatePack } from "./loader.mjs";
import { readLearningProfile } from "./learning-profile.mjs";
import { exerciseTasks, exerciseInstructions, validateGeneratedExercises } from "./authoring.mjs";

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const file = directory => join(directory, "extra-practice.json");
export const extraLimit = 6;
export const isExtraTask = (pack, id) => id.startsWith(`${pack.id}/task/extra-`);

/** Each saved lesson list is checked as if it were part of the pack. A damaged file disables extras only. */
export async function readExtras(pack, directory) {
  try {
    const data = JSON.parse(await readFile(file(directory), "utf8"));
    if (data?.version !== 1 || !data.lessons || typeof data.lessons !== "object" || Array.isArray(data.lessons)) throw new Error("damaged");
    const candidate = structuredClone(pack);
    for (const [id, tasks] of Object.entries(data.lessons)) {
      const lesson = candidate.lessons.find(lesson => lesson.id === id);
      if (!lesson || !Array.isArray(tasks) || tasks.length > extraLimit ||
          !tasks.every(task => isExtraTask(pack, task?.id) && task.role === "generated" && task.generated?.source === "ai")) throw new Error("damaged");
      lesson.tasks.push(...tasks);
    }
    validatePack(candidate);
    return { lessons: data.lessons };
  } catch (error) {
    if (error.code === "ENOENT") return { lessons: {} };
    return { lessons: {}, error: "Extra practice could not be read, so it is hidden. Course lessons and exercises are unaffected. Restore extra-practice.json from a backup or remove it." };
  }
}

/** A copy of the pack whose lessons list extras separately from shipped tasks. */
export function withExtras(pack, extras) {
  const copy = structuredClone(pack);
  for (const lesson of copy.lessons) lesson.extraTasks = extras.lessons[lesson.id] ?? [];
  return copy;
}

export async function extraContext(root, pack, request) {
  if (pack.legacy) throw new Error("Imported courses add exercises through Write practice exercises in the module list.");
  const lesson = pack.lessons.find(lesson => lesson.id === request.moduleId);
  if (!lesson) throw new Error("Choose a written course module for extra practice.");
  const existing = lesson.extraTasks ?? [];
  if (existing.length >= extraLimit) throw new Error(`This module already has ${extraLimit} extra exercises.`);
  const index = pack.modules.findIndex(module => module.id === lesson.id), profile = await readLearningProfile(root);
  return { courseId: pack.id, contentVersion: pack.contentVersion, language: pack.languageId, course: { title: pack.title },
    module: { id: lesson.id, title: lesson.title, intro: lesson.intro,
      steps: lesson.steps.map(step => ({ title: step.title, text: step.text,
        code: [...(step.examples ?? []), ...(step.example ? [step.example] : [])].map(id => lesson.examples[id]?.code).filter(Boolean) })) },
    existingTasks: [...lesson.tasks, ...existing].map(task => task.title),
    earlierModules: pack.modules.slice(0, index).map(module => module.title),
    knownLanguages: profile.configured ? profile.knownLanguages : [] };
}

export function extraTasks(pack, context, document) {
  const start = context.existingTasks.length - pack.lessons.find(lesson => lesson.id === context.module.id).tasks.length;
  const prefix = `extra-${hash(context.module.id).slice(0, 12)}`;
  return exerciseTasks(pack, context, document, index => `${pack.id}/task/${prefix}-${start + index + 1}`);
}

/** Called under the enrollment lock with a pack that already includes extras. */
export async function saveExtras(root, pack, directory, request, options = {}) {
  const context = await extraContext(root, pack, request);
  if (hash(context) !== request.contextHash) throw new Error("The lesson, extra practice or preferences changed during generation. Nothing was saved. Try again.");
  const tasks = extraTasks(pack, context, request.document);
  // Only an in-process caller that ran every check can save. CLI requests cannot supply this option.
  if (options.validated !== hash(tasks)) throw new Error("Generated exercises must pass validation before they are saved.");
  const current = await readExtras(pack, directory);
  if (current.error) throw new Error(current.error);
  const lessons = { ...current.lessons, [request.moduleId]: [...(current.lessons[request.moduleId] ?? []), ...tasks] };
  const temporary = `${file(directory)}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify({ version: 1, lessons }, null, 2) + "\n"); await rename(temporary, file(directory)); }
  finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
  return { saved: tasks.map(task => task.id) };
}

export async function generateExtraPractice(root, configPath, request, options = {}) {
  const { courseCommand, coursePack } = await import("./service.mjs");
  const { askTutor } = await import("../tutor/service.mjs");
  const state = await courseCommand(root, "status", request);
  if (state.enrollment.review) throw new Error("Finish or end the course review before generating extra practice.");
  const pack = await coursePack(root, state.course.id, state.course.contentVersion);
  const context = await extraContext(root, pack, request);
  const pinned = { ...request, courseId: pack.id, contentVersion: pack.contentVersion };
  return askTutor(root, configPath, pinned, { ...options, instructions: exerciseInstructions, buildContext: async () => context,
    finish: async (reply, ensureActive) => {
      let document;
      try { document = JSON.parse(reply); } catch { throw new Error("The provider returned unreadable exercises. Nothing was saved. Try again."); }
      const tasks = extraTasks(pack, context, document);
      // Checks run outside the enrollment lock so course actions stay responsive.
      await validateGeneratedExercises(root, pack, tasks, ensureActive, options.check);
      await ensureActive();
      return courseCommand(root, "save-extras", { ...pinned, contextHash: hash(context), document }, { validated: hash(tasks) });
    } });
}
