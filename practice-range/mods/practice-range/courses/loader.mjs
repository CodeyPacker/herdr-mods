// Bundled courses are data. Only the existing language registry can choose executable runners.
import { readFile } from "node:fs/promises";
import { findLanguage } from "../languages/index.js";

const registry = new Map([["course:ts-foundations", new URL("./packs/typescript-foundations.json", import.meta.url)]]);
const text = value => typeof value === "string" && value.trim().length > 0;
const list = (value, label) => { if (!Array.isArray(value)) throw new Error(`${label} must be a list.`); return value; };
function requireValue(ok, label) { if (!ok) throw new Error(`Invalid course: ${label}.`); }
function unique(items, label) {
  const ids = new Set();
  for (const item of items) {
    requireValue(text(item.id) && !ids.has(item.id), `${label} has an invalid or duplicate ID`);
    ids.add(item.id);
  }
  return ids;
}
const strings = (value, label) => { list(value, label); requireValue(value.every(text), `${label} contains empty text`); };
const localId = value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

/** Validate references and prerequisites before a pack can create any user state. */
export function validatePack(pack) {
  requireValue(pack?.schemaVersion === 1, "unsupported schema version");
  requireValue(/^course:[a-z0-9-]+$/.test(pack.id), "course ID");
  requireValue(/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/.test(pack.contentVersion), "content version");
  requireValue(text(pack.title), "title");
  findLanguage(pack.languageId);
  requireValue(pack.runner?.registeredLanguage === pack.languageId, "runner must match registered language");
  requireValue(/^=\d+\.\d+\.\d+$/.test(pack.runner?.compiler?.range), "compiler must name an exact supported version");
  const entries = list(pack.modules, "modules");
  requireValue(entries.length > 0, "empty course");
  const ids = unique(entries, "modules");
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  for (const entry of entries) {
    requireValue(entry.id.startsWith(`${pack.id}/module/`) && localId(entry.id.slice(`${pack.id}/module/`.length)) && text(entry.title), "module identity");
    requireValue(["available", "planned"].includes(entry.status), "module status");
    strings(entry.prerequisites, "prerequisites");
    strings(entry.teaches, "concepts");
    requireValue(entry.prerequisites.every(id => ids.has(id)), "missing prerequisite");
  }
  requireValue(pack.preview === true || entries.every(entry => entry.status === "available"), "unfinished courses must be labeled previews");
  const visited = new Set(), visiting = new Set();
  function visit(id) {
    requireValue(!visiting.has(id), "cyclic prerequisites");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).prerequisites) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for (const id of ids) visit(id);
  for (const path of list(pack.entryPaths, "entry paths")) requireValue(ids.has(path.start) && text(path.id), "entry path");
  unique(pack.entryPaths, "entry paths");
  const lessons = list(pack.lessons, "lessons");
  const lessonIds = unique(lessons, "lessons"), taskIds = new Set();
  for (const entry of entries) requireValue(lessonIds.has(entry.id) === (entry.status === "available"), "module content and availability disagree");
  for (const lesson of lessons) {
    requireValue(ids.has(lesson.id) && text(lesson.title) && text(lesson.intro), "lesson identity or introduction");
    const tasks = list(lesson.tasks, "tasks"), questions = list(lesson.questions, "questions");
    const localTasks = unique(tasks, "tasks"), questionIds = unique(questions, "questions");
    requireValue(lesson.examples && typeof lesson.examples === "object", "examples");
    for (const example of Object.values(lesson.examples)) {
      requireValue(text(example.code), "example source");
      requireValue(Array.isArray(example.stdout) !== Array.isArray(example.diagnostics), "example must specify output or diagnostics");
    }
    for (const question of questions) {
      requireValue(text(question.prompt) && list(question.choices, "choices").length >= 2, "question choices");
      requireValue(question.choices.every(choice => text(choice.text) && text(choice.feedback)), "choice feedback");
      requireValue(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, "answer index");
      if (question.example) requireValue(Object.hasOwn(lesson.examples, question.example), "question example");
    }
    for (const task of tasks) {
      requireValue(task.id.startsWith(`${pack.id}/task/`) && localId(task.id.slice(`${pack.id}/task/`.length)) && !taskIds.has(task.id), "duplicate or invalid task identity");
      taskIds.add(task.id);
      for (const field of ["title", "prompt", "starter", "solution", "feedback"]) requireValue(text(task[field]), `task ${field}`);
      strings(task.hints, "hints"); strings(task.concepts, "task concepts");
      requireValue(["script", "module"].includes(task.mode), "task mode");
      list(task.rules, "syntax rules");
      for (const field of ["checks", "typeChecks", "rejects"]) strings(task[field] ?? [], field);
      const fixtures = list(task.fixtures, "fixtures");
      requireValue(fixtures.length > 0, "empty fixture suite"); unique(fixtures, "fixtures");
      for (const fixture of fixtures) requireValue(typeof fixture.declarations === "string", "fixture declarations");
    }
    const steps = list(lesson.steps, "steps");
    requireValue(steps.length > 0, "empty lesson");
    for (const step of steps) {
      requireValue(["explanation", "prediction", "walkthrough", "modification", "independent", "debugging"].includes(step.kind), "step kind");
      requireValue(text(step.title) && text(step.text), "step text");
      for (const id of [...(step.tasks ?? []), ...(step.task ? [step.task] : [])]) requireValue(localTasks.has(id), "step task");
      for (const id of step.questions ?? []) requireValue(questionIds.has(id), "step question");
      for (const id of [...(step.examples ?? []), ...(step.example ? [step.example] : [])]) requireValue(Object.hasOwn(lesson.examples, id), "step example");
    }
  }
  return pack;
}

export async function loadCourse(id) {
  const path = registry.get(id);
  if (!path) throw new Error(`Course pack is not installed: ${id}`);
  const pack = validatePack(JSON.parse(await readFile(path, "utf8")));
  requireValue(pack.id === id, "registry identity");
  return pack;
}

export async function listCourses() {
  return Promise.all([...registry.keys()].map(async id => {
    try {
      const pack = await loadCourse(id);
      return { id, title: pack.title, languageId: pack.languageId, contentVersion: pack.contentVersion,
        preview: pack.preview === true, available: pack.lessons.length, total: pack.modules.length };
    } catch (error) { return { id, error: error.message }; }
  }));
}

export function lessonFor(pack, id) {
  const lesson = pack.lessons.find(lesson => lesson.id === id);
  if (!lesson) throw new Error("This module is planned but has not been written yet.");
  return lesson;
}

export function taskFor(pack, id) {
  for (const lesson of pack.lessons) {
    const task = lesson.tasks.find(task => task.id === id);
    if (task) return { task, lesson };
  }
  throw new Error(`Unknown course exercise: ${id}`);
}
