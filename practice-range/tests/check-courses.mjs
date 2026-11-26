// Native render and navigation checks. All user files are isolated in a temporary directory.
import { cp, mkdtemp, rename, writeFile, rm, mkdir } from "node:fs/promises";
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
  const attached = structuredClone(modules);
  attached.attachment = { name: "example-project", commit: "a".repeat(40), available: true };
  attached.repoLessons = {lessons:[{id:"b".repeat(64),target:moduleId,title:"Values in this repo",name:"example-project",commit:"a".repeat(40),scope:"Sampled 1 of 12 source files. Other files were not examined.",sections:[{title:"A value",text:"The exported count starts at one.",references:[{path:"src/count.ts",start:1,end:1,code:"export const count = 1;"}]}]}]};
  const missing = structuredClone(modules);
  missing.attachment = { name: "example-project", commit: "a".repeat(40), available: false, detail: "The repo is unavailable. Bundled lessons still work." };
  const put=async(path,value)=>{const file=join(root,"tutor",path);await mkdir(dirname(file),{recursive:true});await writeFile(file,typeof value==="string"?value:JSON.stringify(value));};
  await put("settings.json",{editor:"vscode",agent:"claude",known:["Python"]});
  await put("courses/example/course.json",{name:"Imported repo",root:join(root,"missing-repo"),commit:"a".repeat(40),language:"typescript",known:["Python"],parts:[{id:"core",title:"Core"}],modules:[{id:"01-count",title:"Count",part:"core"},{id:"02-more",title:"Not written",part:"core"}]});
  await put("courses/example/modules/01-count.json",{title:"Count",intro:"Learn a count.",stops:[{title:"Read the count",file:"src/count.ts",start:1,end:1,anchor:"count",body:"The variable keeps the current count."}],quiz:[{id:"q1",prompt:"What does the declaration store?",choices:["A number","A function"],answer:0,why:"The initializer is numeric."}]});
  await put("courses/example/exercises/01-count.json",{exercises:[{id:"01-print",title:"Print a count",kind:"program",prompt:"Print three.",starter:"// Print a count.\n",solution:"console.log(3);\n",expected:"3",concept:"Count"}]});
  await put("courses/example/progress.json",{modules:{"01-count":{seen:[0],doneAt:"2026-01-01",quiz:{best:1,passed:true},practice:{"01-print":{passed:true,runs:2,hints:1}}}},last:{module:"01-count",stop:0}});
  await put("work/example/01-print/exercise.ts","console.log(3);\n");
  const importList=(await request("import-list")).imports;
  const importPreview=(await request("import-preview",{slug:"example"})).preview;
  const receipt=await request("import-apply",{slug:"example",fingerprint:importPreview.fingerprint});
  const importRequest=(action,value={})=>request(action,{courseId:receipt.imported.courseId,...value});
  const importedModules=await importRequest("status");
  const importedLesson=await importRequest("open",{moduleId:importedModules.course.modules[0].id,step:0});
  const importedQuiz=await importRequest("open",{moduleId:importedModules.course.modules[0].id,step:1});
  const importedTask=await importRequest("task",{taskId:importedModules.course.lessons[0].tasks[0].id});
  const importedCatalog=(await request("list")).courses;
  const cases = { catalog: ["catalog", null], versions: ["catalog", null], modules: ["modules", modules], lesson: ["lesson", modules], "example-output": ["lesson", example],
    prediction: ["lesson", prediction], feedback: ["lesson", feedback], task: ["task", task], solution: ["task", solution], project: ["task", project], review: ["task", review], "ai-lesson": ["lesson", modules], "ai-task": ["task", task], attached: ["modules", attached], "repo-missing": ["modules", missing], error: ["task", task],
    "repo-supplement":["repo-lesson",attached], "repo-generating":["modules",attached],
    imports:["imports",null], "import-preview":["import-preview",null], "import-preferences":["import-preview",null], "import-error":["imports",null],
    "imported-catalog":["catalog",null], "imported-modules":["modules",importedModules], "imported-lesson":["lesson",importedLesson], "imported-quiz":["lesson",importedQuiz], "imported-task":["task",importedTask] };
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
    if (${name === "imported-catalog"}) this.courses.catalog=${JSON.stringify(importedCatalog)};
    this.courses.imports=${JSON.stringify(importList)};
    this.courses.importPreview=${JSON.stringify(importPreview)};
    this.courses.applyImportPreferences=${name === "import-preferences"};
    if (${name === "import-error"}) this.courses.imports.push({slug:"broken",title:"Broken course",error:"Tutor import: progress.json is damaged. The original file is preserved."});
    if (${name === "versions"}) this.courses.catalog[0] = { ...this.courses.catalog[0], enrolledVersion: "0.0.1", versions: ["0.0.1", "0.1.0-preview.1"] };
    this.courses.data = ${JSON.stringify(data)};
    this.courses.page = ${JSON.stringify(page)};
    if (${name === "repo-supplement"}) {
      this.courses.repoLessonId="b".repeat(64);
      this.courses.back(cx);
      if(this.courses.page!=="modules") throw new Error("Repo lesson must return to modules");
      this.courses.page="repo-lesson";
    }
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
    if (${name === "repo-generating"}) {
      this.tutor={enabled:true,provider:"claude"};
      this.tutorRequestId="repo-fixture";
      this.tutorBusy=true;
      this.courses.generatingRepoLesson=true;
      this.courses.busy="Writing a lesson from sampled repo files…";
    }
    if(${JSON.stringify(page)} === "import-preview") {
      this.courses.back(cx);
      if(this.courses.page!=="imports") throw new Error("Import preview must return to the course list");
      this.courses.page="import-preview";
    }
    if(${JSON.stringify(page)} === "imports") {
      this.courses.back(cx);
      if(this.courses.page!=="catalog") throw new Error("Import list must return to the catalog");
      this.courses.page="imports";
    }
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
