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
  const attached = structuredClone(modules);
  attached.attachment = { name: "example-project", commit: "a".repeat(40), available: true };
  attached.repoLessons = {lessons:[{id:"b".repeat(64),target:moduleId,title:"Values in this repo",name:"example-project",commit:"a".repeat(40),scope:"Sampled 1 of 12 source files. Other files were not examined.",sections:[{title:"A value",text:"The exported count starts at one.",references:[{path:"src/count.ts",start:1,end:1,code:"export const count = 1;"}]}]}]};
  const missing = structuredClone(modules);
  missing.attachment = { name: "example-project", commit: "a".repeat(40), available: false, detail: "The repo is unavailable. Bundled lessons still work." };
  const evidence=structuredClone(modules), evidenceIds=evidence.course.modules.filter(module=>module.status==="available").map(module=>module.id);
  evidence.evidence=Object.fromEntries(evidenceIds.map((id,index)=>[id,{status:["demonstrated","independent-once","practiced","read","skipped","started","new"][index%7],independent:index%3,practiced:index%4,reviewed:index===0}]));
  evidence.recommendation={kind:"practice-review",count:2,reason:"2 practice drills linked to this course are due for review."};
  const drillError=structuredClone(evidence);drillError.drillError="Practice progress could not be read, so linked drills are not included in course evidence.";
  const readinessId=modules.course.readiness[0].task.id;
  const readiness=structuredClone(modules);readiness.enrollment.entryPath="experienced";
  readiness.enrollment.tasks[readinessId]={attempts:1,passes:1,independentPasses:1,hintCount:0,history:[]};
  const readinessTask=await request("task",{taskId:readinessId});
  const updateAvailable=structuredClone(modules);updateAvailable.update={to:"0.1.0-preview.3",compatible:true,started:false,newTasks:2};
  updateAvailable.migration={from:"0.1.0-preview.1",to:modules.course.contentVersion,retiredTasks:["course:ts-foundations/task/old"]};
  const updateBlocked=structuredClone(modules);updateBlocked.update={to:"0.2.0",compatible:false,started:false,newTasks:0};
  const extraId=`${courseId}/task/extra-fixture-1`, extraLesson=lesson=>lesson.id===moduleId;
  const extras=structuredClone(modules), extraView={...structuredClone(task.course.lessons.find(extraLesson).tasks.find(item=>item.id===taskId)),id:extraId,title:"Add arrivals",generated:true,role:"generated"};
  extras.course.lessons.find(extraLesson).extraTasks=[extraView];
  const extrasError=structuredClone(modules);extrasError.extrasError="Extra practice could not be read, so it is hidden.";
  const extraTask=structuredClone(task);extraTask.course.lessons.find(extraLesson).extraTasks=[extraView];
  extraTask.enrollment.tasks[extraId]=extraTask.enrollment.tasks[taskId];extraTask.enrollment.activeTask=extraId;
  // The C# course goes through the same panels with its own runner, case boxes and practice links.
  const csharpId = "course:cs-foundations", csharpModule = `${csharpId}/module/values`;
  const csharp = (action, value = {}) => courseCommand(join(root, "data"), action, { courseId: csharpId, ...value });
  await csharp("enroll");
  const csharpModules = await csharp("open", { moduleId: csharpModule, step: 0 });
  const csharpExample = await csharp("example", { moduleId: csharpModule, exampleId: "board" });
  const csharpTask = await csharp("task", { taskId: `${csharpId}/task/values-arrival-log` });
  const csharpMembers = await csharp("task", { taskId: `${csharpId}/task/patterns-lane` });
  const csharpProject = await csharp("task", { taskId: `${csharpId}/task/report-audit` });
  const csharpReadiness = await csharp("task", { taskId: `${csharpId}/task/readiness-r1` });
  const csharpCases = { "csharp-modules": ["modules", csharpModules], "csharp-lesson": ["lesson", csharpExample], "csharp-task": ["task", csharpTask],
    "csharp-members-task": ["task", csharpMembers], "csharp-project": ["task", csharpProject], "csharp-readiness-task": ["task", csharpReadiness] };
  // The SQL course: result tables as example output, data cases, and a task checked by the state it leaves.
  const sqlId = "course:sql-foundations", sqlModule = `${sqlId}/module/where`;
  const sql = (action, value = {}) => courseCommand(join(root, "data"), action, { courseId: sqlId, ...value });
  await sql("enroll");
  const sqlModules = await sql("open", { moduleId: sqlModule, step: 0 });
  const sqlExample = await sql("example", { moduleId: sqlModule, exampleId: "sales" });
  const sqlTask = await sql("task", { taskId: `${sqlId}/task/where-small-items` });
  const sqlTable = await sql("task", { taskId: `${sqlId}/task/tables-shipments` });
  const sqlReadiness = await sql("task", { taskId: `${sqlId}/task/readiness-r1` });
  const sqlCases = { "sql-modules": ["modules", sqlModules], "sql-lesson": ["lesson", sqlExample], "sql-task": ["task", sqlTask],
    "sql-table-task": ["task", sqlTable], "sql-readiness-task": ["task", sqlReadiness] };
  const cases = { ...csharpCases, ...sqlCases, catalog: ["catalog", null], versions: ["catalog", null], modules: ["modules", modules], lesson: ["lesson", modules], "example-output": ["lesson", example],
    prediction: ["lesson", prediction], feedback: ["lesson", feedback], task: ["task", task], solution: ["task", solution], project: ["task", project], review: ["task", review], "ai-lesson": ["lesson", modules], "ai-task": ["task", task], attached: ["modules", attached], "repo-missing": ["modules", missing], error: ["task", task],
    "repo-supplement":["repo-lesson",attached], "repo-generating":["modules",attached],
    "repo-source":["source",attached], "repo-source-cached":["source",attached], "repo-source-missing":["source",attached],
    "language-course-entry":["catalog",review], "setup-course-entry":["catalog",review],
    "learning-profile":["catalog",null], "learning-profile-error":["modules",modules],
    "module-evidence":["modules",evidence], readiness:["modules",readiness], "readiness-task":["task",readinessTask], "update-available":["modules",updateAvailable], "update-blocked":["modules",updateBlocked], "extra-practice":["lesson",extras], "extras-error":["lesson",extrasError], "extra-task":["task",extraTask], "extra-generating":["lesson",extras], "drill-error":["modules",drillError] };
  const requested = process.argv.slice(2);
  for (const name of requested) if (!Object.hasOwn(cases, name)) throw new Error(`Unknown course fixture: ${name}`);
  for (const [name, [page, data]] of Object.entries(cases).filter(([name]) => !requested.length || requested.includes(name))) {
    const folder = join(root, name);
    const language = name.startsWith("csharp-") ? "csharp" : name.startsWith("sql-") ? "sql" : "typescript";
    const drill = { csharp: "variables/integer", sql: "where/equals-number", typescript: "variables/const-number" }[language];
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
    if (${["extra-practice","extra-generating"].includes(name)}) this.tutor={enabled:true,provider:"claude"};
    if (${name === "learning-profile"}) {
      this.courses.profile={configured:true,knownLanguages:["Python","JavaScript"]};
      this.courses.knownInput.set_value("Python, JavaScript");
    }
    if (${name === "learning-profile-error"}) this.courses.profile={configured:true,knownLanguages:[],error:"The learning profile could not be read. Standard lessons remain available."};
    if (${name.startsWith("repo-source")}) {
      this.courses.repoLessonId="b".repeat(64);
      this.courses.sourceReturnPage="repo-lesson";
      this.courses.source={path:"src/count.ts",commit:"a".repeat(40),start:1,end:3,total:150,referenceStart:2,referenceEnd:2,previous:null,next:4,code:"// Context\\nexport const count = 1;\\n// More context"};
      if (${name === "repo-source-cached" || name === "repo-source-missing"}) {
        this.courses.source.total=null;this.courses.source.next=null;
        this.courses.source.detail="The pinned file is unavailable. Showing the saved excerpt.";
      }
      if (${name === "repo-source-missing"}) {
        this.courses.source.code="";this.courses.source.detail="No saved excerpt is available. Attach a clone containing this commit to read it.";
      }
      this.courses.back(cx);
      if(this.courses.page!=="repo-lesson") throw new Error("Source navigation must return to its original lesson");
      this.courses.page="source";
    }
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
    if (${name === "language-course-entry" || name === "setup-course-entry"}) {
      this.screen=${JSON.stringify(name === "setup-course-entry" ? "setup" : "languages")};
      const origin=this.screen, priorCourse=this.courses.data;
      let requested="";
      this.courses.run=action=>{requested=action;};
      this.editor=null;this.enabledLanguages=[];this.setup.tools=null;
      this.courses.show(cx,${JSON.stringify(name === "language-course-entry" ? "typescript" : "")});
      if (requested!=="list" || this.screen!=="courses") throw new Error("Course reading must be available before installing a compiler or editor");
      if (this.courses.languageFilter!==${JSON.stringify(name === "language-course-entry" ? "typescript" : "")}) throw new Error("The language card must filter its courses");
      if (this.courses.data!==priorCourse || this.state!==prior) throw new Error("Browsing courses must preserve course and practice sessions");
      this.courses.back(cx);
      if(this.screen!==origin) throw new Error("Course catalog must return to setup or languages, including during a paused review");
      this.screen="courses";
      this.courses.run=()=>{};
    }
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
    if (${JSON.stringify(page)} === "lesson") {
      this.courses.key("escape", cx);
      if (this.courses.page !== "modules") throw new Error("Escape must return to modules");
      this.courses.page = "lesson";
      this.enabledLanguages = [${JSON.stringify(language)}];
      this.courses.practiceTopic(${JSON.stringify(drill)}, cx);
      if (this.screen !== "topics" || this.pendingTopic !== ${JSON.stringify(drill.split("/")[0])} || this.lastPerformed?.value !== ${JSON.stringify(language)}) throw new Error("Lesson practice links must choose the matching language and topic");
      if (this.state !== prior) throw new Error("Lesson links must not replace direct-practice state while loading");
      this.screen = "courses";
    }
    if (${name === "extra-generating"}) {
      this.tutorRequestId="extra-fixture";this.tutorBusy=true;this.courses.generatingExtras=true;
      this.courses.busy="Writing extra practice, then checking every answer…";
    }
  }
}
`);
    const result = spawnSync("herdr-app", ["check", folder], { encoding: "utf8", timeout: 30000 });
    if (result.status !== 0) throw new Error(`${name}: ${result.error?.message || result.stdout || result.stderr}`);
    console.log(`${name}: native course panel passed`);
  }
} finally { await rm(root, { recursive: true, force: true }); }
