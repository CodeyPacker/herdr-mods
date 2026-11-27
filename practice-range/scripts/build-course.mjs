// Compile reviewed authoring files into a self-contained data pack. No generated executable code.
import { readFile } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePack } from "../mods/practice-range/courses/loader.mjs";
import { writeCoursePack } from "../mods/practice-range/courses/storage.mjs";
import { readModule } from "./course-markdown.mjs";
import { access } from "node:fs/promises";

const base = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// node practice-range/scripts/build-course.mjs [typescript|csharp|sql|dsa|api-design|docker|ci-cd|networking|system-design|databases|security]
const language = process.argv[2] ?? "typescript";
if (!["typescript", "csharp", "sql", "dsa", "api-design", "docker", "ci-cd", "networking", "system-design", "databases", "security"].includes(language)) throw new Error("Usage: build-course.mjs [typescript|csharp|sql|dsa|api-design|docker|ci-cd|networking|system-design|databases|security]");
const draft = resolve(base, "course-drafts", language);
async function source(folder, path) {
  const file = resolve(folder, path);
  const rel = relative(draft, file);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`Source outside course draft: ${path}`);
  return readFile(file, "utf8");
}
const json = async (folder, path) => JSON.parse(await source(folder, path));
const { runtimeContentVersion, ...manifest } = await json(draft, "manifest.json");
async function compileTask(folder, path) {
  const taskFolder = dirname(resolve(folder, path));
  const task = await json(folder, path);
  const { alternative, wrongAnswers, moduleSources, workspace, ...content } = task;
  return { ...content,
    starter: await source(taskFolder, task.starter), solution: await source(taskFolder, task.solution),
    fixtures: await Promise.all(task.fixtures.map(async fixture => ({ ...fixture, declarations: await source(taskFolder, fixture.declarations) }))),
    ...(moduleSources ? { modules: Object.fromEntries(await Promise.all(Object.entries(moduleSources).map(async ([name, path]) => [name, await source(taskFolder, path)]))) } : {}),
    ...(workspace ? { workspace: { entry: workspace.entry,
      editable: await Promise.all(workspace.editable.map(async file => ({ file: file.file,
        starter: await source(taskFolder, file.starter), solution: await source(taskFolder, file.solution) }))) } } : {}),
  };
}
const modules = [];
for (const entry of manifest.modules.filter(entry => entry.source)) {
  const folder = dirname(resolve(draft, entry.source.path));
  // module.md wins over module.json in the same folder. Either way examples come back with their code.
  const markdown = resolve(folder, "module.md");
  const path = await access(markdown).then(() => markdown, () => resolve(draft, entry.source.path));
  const module = await readModule(path, (dir, file) => source(dir, file));
  const examples = module.examples;
  const tasks = [];
  for (const entry of module.tasks) tasks.push(await compileTask(folder, entry.path));
  modules.push({ ...module, examples, tasks });
}
// Project checkpoints are tasks inside their module, so they count as that module's evidence.
const projectFolder = manifest.project ? dirname(resolve(draft, manifest.project)) : draft;
const projectSource = manifest.project ? await json(draft, manifest.project) : { checkpoints: [] };
const checkpoints = [];
for (const checkpoint of projectSource.checkpoints) {
  let taskId = checkpoint.existingTask ?? null;
  if (checkpoint.task) {
    const task = await compileTask(projectFolder, checkpoint.task), lesson = modules.find(module => module.id === checkpoint.module);
    lesson.tasks.push(task);
    lesson.steps.push({ kind: "independent", title: task.title, text: "A tracker project checkpoint. Later checkpoints build on the same task data.", tasks: [task.id] });
    taskId = task.id;
  }
  checkpoints.push({ id: checkpoint.id, title: checkpoint.title, module: checkpoint.module, taskId });
}
// Readiness checks belong to no module. A pass records that task only, not every module in its group.
const readiness = [];
for (const group of manifest.readiness ?? []) readiness.push({ id: group.id, title: group.title, modules: group.modules, task: await compileTask(draft, group.task) });
const pack = {
  ...manifest, schemaVersion: 1, contentVersion: runtimeContentVersion, preview: true,
  ...(manifest.project ? { project: { id: projectSource.id, title: projectSource.title, checkpoints } } : {}), readiness,
  modules: manifest.modules.map(({ source, ...entry }) => ({ ...entry, status: source ? "available" : "planned" })),
  lessons: modules,
};
validatePack(pack);
// A language's first course is named for the language. A reading course, or a later course in a
// language (its draft folder is not the language's name), keeps its draft folder's name.
const ownName = manifest.kind === "reading" || manifest.languageId !== language;
const destination = resolve(base, `mods/practice-range/courses/packs/${ownName ? language : `${language}-foundations`}.json`);
await writeCoursePack(destination, pack);
console.log(`Built ${pack.id}: ${modules.length} preview modules, ${modules.reduce((n, m) => n + m.tasks.length, 0)} tasks.`);
