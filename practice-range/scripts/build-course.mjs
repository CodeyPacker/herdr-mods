// Compile reviewed authoring files into a self-contained data pack. No generated executable code.
import { readFile } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePack } from "../mods/practice-range/courses/loader.mjs";
import { writeCoursePack } from "../mods/practice-range/courses/storage.mjs";

const base = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const draft = resolve(base, "course-drafts/typescript");
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
  const module = await json(draft, entry.source.path);
  const examples = {};
  for (const [id, example] of Object.entries(module.examples)) {
    examples[id] = { ...example, code: await source(folder, example.source.path) };
    delete examples[id].source;
  }
  const tasks = [];
  for (const entry of module.tasks) tasks.push(await compileTask(folder, entry.path));
  modules.push({ ...module, examples, tasks });
}
// Project checkpoints are tasks inside their module, so they count as that module's evidence.
const projectFolder = dirname(resolve(draft, manifest.project));
const projectSource = await json(draft, manifest.project);
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
  project: { id: projectSource.id, title: projectSource.title, checkpoints }, readiness,
  modules: manifest.modules.map(({ source, ...entry }) => ({ ...entry, status: source ? "available" : "planned" })),
  lessons: modules,
};
validatePack(pack);
const destination = resolve(base, "mods/practice-range/courses/packs/typescript-foundations.json");
await writeCoursePack(destination, pack);
console.log(`Built ${pack.id}: ${modules.length} preview modules, ${modules.reduce((n, m) => n + m.tasks.length, 0)} tasks.`);
