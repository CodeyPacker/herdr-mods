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
  for (const entry of module.tasks) {
    const taskFolder = dirname(resolve(folder, entry.path));
    const task = await json(folder, entry.path);
    const { alternative, wrongAnswers, moduleSources, workspace, ...content } = task;
    tasks.push({ ...content,
      starter: await source(taskFolder, task.starter), solution: await source(taskFolder, task.solution),
      fixtures: await Promise.all(task.fixtures.map(async fixture => ({ ...fixture, declarations: await source(taskFolder, fixture.declarations) }))),
      ...(moduleSources ? { modules: Object.fromEntries(await Promise.all(Object.entries(moduleSources).map(async ([name, path]) => [name, await source(taskFolder, path)]))) } : {}),
      ...(workspace ? { workspace: { entry: workspace.entry,
        editable: await Promise.all(workspace.editable.map(async file => ({ file: file.file,
          starter: await source(taskFolder, file.starter), solution: await source(taskFolder, file.solution) }))) } } : {}),
    });
  }
  modules.push({ ...module, examples, tasks });
}
const pack = {
  ...manifest, schemaVersion: 1, contentVersion: runtimeContentVersion, preview: true,
  modules: manifest.modules.map(({ source, ...entry }) => ({ ...entry, status: source ? "available" : "planned" })),
  lessons: modules,
};
validatePack(pack);
const destination = resolve(base, "mods/practice-range/courses/packs/typescript-foundations.json");
await writeCoursePack(destination, pack);
console.log(`Built ${pack.id}: ${modules.length} preview modules, ${modules.reduce((n, m) => n + m.tasks.length, 0)} tasks.`);
