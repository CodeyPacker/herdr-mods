// Native render and navigation checks. All user files are isolated in a temporary directory.
import { cp, mkdtemp, rename, writeFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../mods/practice-range");
const root = await mkdtemp(join(tmpdir(), "herdr-course-panels-"));
const courseId = "course:ts-foundations", moduleId = `${courseId}/module/values`;
const taskId = `${courseId}/task/remaining`;
try {
  const request = (action, value = {}) => courseCommand(join(root, "data"), action, { courseId, ...value });
  const catalog = (await request("list")).courses;
  await request("enroll");
  const modules = await request("open", { moduleId, step: 0 });
  const prediction = await request("open", { moduleId, step: 1 });
  const feedback = await request("question", { moduleId, questionId: "predict-count", choice: 1 });
  const example = await request("example", { moduleId, exampleId: "board" });
  const task = await request("task", { taskId });
  const solution = await request("answer", { taskId });
  const project = await request("task", { taskId: `${courseId}/task/report-audit` });
  const review = structuredClone(task);
  review.enrollment.review = { ids: [taskId], index: 0 };
  const cases = { catalog: ["catalog", null], versions: ["catalog", null], modules: ["modules", modules], lesson: ["lesson", modules], "example-output": ["lesson", example],
    prediction: ["lesson", prediction], feedback: ["lesson", feedback], task: ["task", task], solution: ["task", solution], project: ["task", project], review: ["task", review], "ai-lesson": ["lesson", modules], "ai-task": ["task", task], error: ["task", task] };
  const requested = process.argv.slice(2);
  for (const name of requested) if (!Object.hasOwn(cases, name)) throw new Error(`Unknown course fixture: ${name}`);
  for (const [name, [page, data]] of Object.entries(cases).filter(([name]) => !requested.length || requested.includes(name))) {
    const folder = join(root, name);
    await cp(source, folder, { recursive: true, filter: path => !path.split(/[\\/]/).includes("node_modules") });
    await rename(join(folder, "main.js"), join(folder, "practice-panel.js"));
    await writeFile(join(folder, "main.js"), `import Syntax from "./practice-panel.js";
export default class Fixture extends Syntax {
  perform(action, value) { this.lastPerformed = { action, value }; }
  init(props, cx) {
    super.init(props, cx);
    this.screen = "courses";
    this.editor = "vscode";
    this.editorSettingsLoaded = true;
    this.editorDefaultSet = true;
    this.setupCompleted = true;
    this.courses.catalog = ${JSON.stringify(catalog)};
    if (${name === "versions"}) this.courses.catalog[0] = { ...this.courses.catalog[0], enrolledVersion: "0.0.1", versions: ["0.0.1", "0.1.0-preview.1"] };
    this.courses.data = ${JSON.stringify(data)};
    this.courses.page = ${JSON.stringify(page)};
    if (${name.startsWith("ai-")}) {
      this.tutor = { enabled: true, provider: "claude" };
      this.tutorThreads[this.courses.helpKey()] = [{ role: "assistant", content: "TypeScript infers a number from the initial value." }];
      if (this.tutorKey() !== this.courses.helpKey()) throw new Error("Course chat must use a separate conversation key");
    }
    this.courses.error = ${JSON.stringify(name === "error" ? "The TypeScript compiler is missing. Open Setup to install it." : "")};
    const prior = this.state;
    if (this.courses.data?.file && this.courses.page === "task" && this.editorTarget().file !== this.courses.data.file) throw new Error("Course editor must target the course answer");
    if (this.state !== prior) throw new Error("Course rendering must preserve direct practice");
    this.courses.run = () => {};
    this.courses.key("h", cx);
    this.courses.busy = "Checking…";
    this.action("topics", cx);
    if (this.screen !== "courses") throw new Error("Course checks must block navigation until the snapshot is saved");
    this.courses.busy = "";
    if (${JSON.stringify(page)} === "lesson") {
      this.courses.key("escape", cx);
      if (this.courses.page !== "modules") throw new Error("Escape must return to modules");
      this.courses.page = "lesson";
      this.enabledLanguages = ["typescript"];
      this.courses.practiceTopic("variables/const-number", cx);
      if (this.screen !== "topics" || this.pendingTopic !== "variables" || this.lastPerformed?.value !== "typescript") throw new Error("Lesson practice links must choose the matching language and topic");
      if (this.state !== prior) throw new Error("Lesson links must not replace direct-practice state while loading");
      this.screen = "courses";
    }
  }
}
`);
    const result = spawnSync("herdr-app", ["check", folder], { encoding: "utf8", timeout: 30000 });
    if (result.status !== 0) throw new Error(`${name}: ${result.error?.message || result.stdout || result.stderr}`);
    console.log(`${name}: native course panel passed`);
  }
} finally { await rm(root, { recursive: true, force: true }); }
