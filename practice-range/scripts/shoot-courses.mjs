// Screenshot the course screens in a separate Herdr window, so the owner's window is never driven.
// node practice-range/scripts/shoot-courses.mjs [csharp|typescript|sql|api-design] [output folder]
// Herdr tabs live in a shared backend, so this makes one temporary space and closes it at the end.
import { cp, mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../mods/practice-range");
const courses = {
  csharp: { id: "course:cs-foundations", module: "save", task: "values-arrival-log" },
  typescript: { id: "course:ts-foundations", module: "values", task: "remaining" },
  sql: { id: "course:sql-foundations", module: "where", task: "where-small-items" },
  "api-design": { id: "course:api-design", module: "methods", task: null },
};
const language = process.argv[2] ?? "csharp";
const course = courses[language];
if (!course) throw new Error(`Usage: shoot-courses.mjs [${Object.keys(courses).join("|")}] [output folder]`);
const output = resolve(process.argv[3] ?? join(tmpdir(), "course-shots", language));
const home = await mkdtemp(join(tmpdir(), "course-shots-home-"));
const env = { ...process.env, HERDR_APP_HOME: home };
/** @param {string[]} args */
const app = (...args) => {
  const result = spawnSync("herdr-app", args, { env, encoding: "utf8", timeout: 30000 });
  if (result.status !== 0) throw new Error(`herdr-app ${args.join(" ")}: ${result.stderr || result.stdout}`);
  return result.stdout;
};
const doJson = (command, value) => JSON.parse(app("do", command, JSON.stringify(value)));

// Course states, read from a fresh enrollment in the temporary home.
const data = join(home, "course-data");
const request = (action, value = {}) => courseCommand(data, action, { courseId: course.id, ...value });
const catalog = (await request("list")).courses;
await request("enroll");
const moduleId = `${course.id}/module/${course.module}`;
const states = {
  "languages-screen": ["languages", null],
  catalog: ["catalog", null],
  modules: ["modules", await request("open", { moduleId, step: 0 })],
  lesson: ["lesson", await request("open", { moduleId, step: 0 })],
  "lesson-step-2": ["lesson", await request("open", { moduleId, step: 1 })],
  settings: ["settings", await request("open", { moduleId, step: 0 })],
};
if (course.task) {
  const taskId = `${course.id}/task/${course.task}`;
  const task = await request("task", { taskId });
  states.task = ["task", task];
  // A made-up failed check, so the results box can be seen without a compiler.
  const failed = structuredClone(task);
  failed.enrollment.tasks[taskId].attempts = 1;
  failed.enrollment.tasks[taskId].result = { passed: false, title: "1 of 2 checks pass", at: 1,
    checks: [{ label: "The first case prints the expected lines", passed: true }, { label: "The empty case prints 0", passed: false, expected: "0", actual: "2" }],
    details: ["Check 2: expected 0, got 2"] };
  states["task-result"] = ["task", failed];
}

const scan = { node: { ready: true, version: "25" },
  languages: Object.fromEntries(["csharp", "typescript", "sql"].map(id => [id, { ready: true, detail: "ready", passed: 0, total: 800 }])),
  editors: { neovim: { found: true, version: "NVIM" }, vscode: { found: true, version: "1" } } };
await mkdir(join(home, "mods"), { recursive: true });
await symlink(source, join(home, "mods", "practice-range"));
for (const [name, [page, value]] of Object.entries(states)) {
  const folder = join(home, "mods", `shot-${name}`);
  await cp(source, folder, { recursive: true, filter: path => !path.split(/[\\/]/).includes("node_modules") });
  await rename(join(folder, "main.js"), join(folder, "practice-panel.js"));
  await writeFile(join(folder, "main.js"), `import Syntax from "./practice-panel.js";
export default class Fixture extends Syntax {
  perform() {}
  loadSetup() {}
  init(props, cx) {
    super.init(props, cx);
    this.setup.tools = ${JSON.stringify(scan)};
    this.setup.tutors = { claude: { found: true, version: "", ready: true, detail: "" }, codex: { found: false, version: "", ready: false, detail: "" } };
    this.enabledLanguages = ["csharp", "typescript", "sql"];
    this.screen = "courses"; this.editor = "vscode"; this.editorSettingsLoaded = true; this.editorDefaultSet = true; this.setupCompleted = true;
    this.courses.catalog = ${JSON.stringify(catalog)};
    this.courses.data = ${JSON.stringify(value)};
    this.courses.page = ${JSON.stringify(page)};
    if (${JSON.stringify(page)} === "languages") this.screen = "languages";
    this.courses.settingsReturn = this.courses.page === "settings" ? "modules" : "catalog";
    this.courses.run = () => {};
  }
}
`);
}
await writeFile(join(home, "shared.json"), JSON.stringify({ "frame.welcomed": "finished", "sidebar.collapsed": true }));

const window = spawn("herdr-app", [], { env, detached: true, stdio: "ignore" });
window.unref();
let space = "";
try {
  for (let tries = 0; spawnSync("herdr-app", ["status"], { env }).status !== 0; tries++) {
    if (tries > 30) throw new Error("The screenshot window did not start.");
    await sleep(1000);
  }
  await sleep(1500);
  space = doJson("space.new", { name: "Course screenshots", folder: tmpdir(), tab: "blank" }).space;
  for (let step = 0; step < 3; step++) app("do", "app.zoom_out");
  await mkdir(output, { recursive: true });
  for (const name of Object.keys(states)) {
    doJson("tab.new", { name, mod: `shot-${name}` });
    await sleep(2500);
    app("shot", join(output, `${name}.png`));
    console.log(join(output, `${name}.png`));
  }
} finally {
  if (space) try { doJson("space.close", { id: space, confirmed: true }); } catch (error) { console.error(`Close the "Course screenshots" space by hand: ${error.message}`); }
  try { process.kill(window.pid); } catch {}
  await sleep(500);
  await rm(home, { recursive: true, force: true });
}
