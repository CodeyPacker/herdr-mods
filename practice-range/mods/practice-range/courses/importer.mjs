// Import through an immutable snapshot. Never write to Tutor or replace an existing answer.
import { readFile, writeFile, readdir, mkdir, realpath, rename, rm, open, stat } from "node:fs/promises";
import { join, dirname, relative, isAbsolute, resolve, basename } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { validatePack, courseFolderName } from "./loader.mjs";
import { createEnrollment, newTaskProgress, validateState } from "./service.mjs";
import { readPinnedExcerpt } from "./repo.mjs";

const digest = value => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
const segment = value => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,150}$/.test(value) && !value.includes("..");
const key = value => `${String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55) || "item"}-${digest(String(value)).slice(0,8)}`;
const jsonText = value => JSON.stringify(value,null,2)+"\n";
const text = value => typeof value === "string" && value.trim();
function fail(message) { throw new Error(`Tutor import: ${message}`); }

async function reader(sourceRoot) {
  const root = await realpath(sourceRoot), files = new Map();
  async function read(path) {
    if (files.has(path)) return files.get(path);
    let data = null;
    try {
      const file = await realpath(join(root,path)), rel = relative(root,file);
      if (rel.startsWith("..") || isAbsolute(rel)) fail(`a source link leaves the Tutor data folder: ${path}`);
      data = await readFile(file);
      if (data.length > 2 * 1024 * 1024) fail(`a source file is too large: ${path}`);
    } catch(error) { if(error.code !== "ENOENT") throw error; }
    files.set(path,data); return data;
  }
  async function json(path) {
    const data = await read(path);
    if (data === null) return null;
    try { return JSON.parse(data.toString("utf8").replace(/^\uFEFF/,"")); }
    catch { fail(`${path} is damaged. The original file has been preserved.`); }
  }
  async function stable() {
    for (const [path,previous] of files) {
      let current = null;
      try {
        const file = await realpath(join(root,path)), rel = relative(root,file);
        if (rel.startsWith("..") || isAbsolute(rel)) fail("a source link changed during import");
        current = await readFile(file);
      } catch(error) { if(error.code !== "ENOENT") throw error; }
      if ((current === null) !== (previous === null) || (current && !current.equals(previous))) fail("source files changed. Preview the import again.");
    }
  }
  return { root, read, json, stable, fingerprint:()=>digest([...files].sort(([a],[b])=>a.localeCompare(b)).map(([path,data])=>[path,data===null?null:digest(data)])) };
}

function safeReference(source, commit) {
  const path = source?.file;
  if (!text(path) || path.includes("\\") || path.startsWith("/") || path.split("/").some(part=>part==="..") || path.includes("\0") ||
      !Number.isInteger(source.start) || !Number.isInteger(source.end) || source.start < 1 || source.end < source.start || source.end-source.start > 1000) fail("a repo excerpt has an invalid file or line range");
  return { path, start:source.start, end:source.end, anchor:typeof source.anchor==="string"?source.anchor:"", commit };
}

function convertTask(ex,id,languageId) {
  if (!segment(ex.id) || !["title","prompt","starter","solution"].every(field=>text(ex[field]))) fail("an exercise is missing its ID, prompt, starter or reference answer");
  const checks=[], labels=[];
  if (ex.kind === "program") {
    if (typeof ex.expected!=="string") fail("a program has no expected output");
    if (languageId === "typescript") {
      const expected=ex.expected.replaceAll("\r","").split("\n").map(line=>line.trimEnd()).join("\n").replace(/\n+$/,"");
      checks.push(`__logs().join("\\n").replace(/\\r/g, "").split("\\n").map(line => line.trimEnd()).join("\\n").replace(/\\n+$/, "") === ${JSON.stringify(expected)}`);
    }
    labels.push("The printed output must match the original exercise.");
  } else if ((languageId==="typescript" && ex.kind==="checks") || (languageId==="csharp" && ex.kind==="types")) {
    const call=languageId==="csharp"?"Check":"check";
    for(const line of String(ex.checks??"").split("\n").map(line=>line.trim()).filter(Boolean)) {
      const name = new RegExp(`^${call}\\(\\s*("(?:[^"\\\\]|\\\\.)*")`).exec(line);
      if(!name) fail(`an exercise check does not start with ${call}("name", ...)`);
      labels.push(JSON.parse(name[1]));
      checks.push(languageId==="csharp" ? `((Func<bool>)(() => { bool ok = false; void Check(string name, bool value) { ok = value; }\n${line}\nreturn ok; }))()`
        : `(() => { let ok = false; const check = (_name: string, value: boolean): void => { ok = value; };\n${line}\nreturn ok; })()`);
    }
    if(!checks.length) fail("an exercise has no checks");
  } else fail(`unsupported ${languageId} exercise kind: ${ex.kind}`);
  const declarations="";
  return {id,title:ex.title,prompt:ex.prompt,starter:ex.starter,solution:ex.solution,role:"imported",hints:[],
    concepts:[text(ex.concept)?ex.concept:"Imported practice"],mode:languageId==="csharp"?ex.kind:"script",rules:[],checks,checkLabels:labels,
    typeChecks:[],rejects:[],fixtures:[{id:"imported",declarations}],feedback:"Use the original contract and the compiler feedback. The reference answer is available through Show solution.",
    legacy:{source:"tutor",id:ex.id,kind:ex.kind,...(ex.kind==="program"?{expected:ex.expected}:{})}};
}

function legacyEvidence(raw) {
  const result={};
  for(const field of ["best","attempts","last","runs","hints"]) if(Number.isInteger(raw?.[field]) && raw[field]>=0) result[field]=raw[field];
  for(const field of ["passed","gaveUp"]) if(typeof raw?.[field]==="boolean") result[field]=raw[field];
  if(typeof raw?.at==="string") result.at=raw.at;
  if(Array.isArray(raw?.missed)) result.missed=raw.missed.filter(id=>typeof id==="string");
  return result;
}
function moduleEvidence(previous) {
  const result={seen:Array.isArray(previous.seen)?previous.seen.filter(index=>Number.isInteger(index)&&index>=0):[],quiz:legacyEvidence(previous.quiz),practice:Object.create(null)};
  if(Number.isInteger(previous.stop)&&previous.stop>=0) result.stop=previous.stop;
  if(typeof previous.doneAt==="string") result.doneAt=previous.doneAt;
  for(const [id,value] of Object.entries(previous.practice??{})) result.practice[id]=legacyEvidence(value);
  return result;
}

export async function previewTutor(root,sourceRoot,slug) {
  if(!segment(slug)) fail("invalid course folder");
  const source=await reader(sourceRoot), base=`courses/${slug}`;
  const course=await source.json(`${base}/course.json`);
  if(!course || !Array.isArray(course.modules) || !course.modules.length || course.modules.length>200) fail("the course outline is missing or invalid");
  const languageId=course.language??"csharp";
  if(!["typescript","csharp"].includes(languageId)) fail(`unsupported course language: ${languageId}`);
  const initialWarnings=[];
  let settings={};
  try { settings=await source.json("settings.json")??{}; }
  catch { initialWarnings.push("Tutor settings are damaged. The course can still import, but no preferences will be copied."); }
  const old=await source.json(`${base}/progress.json`)??{modules:{}};
  if(!old.modules || typeof old.modules!=="object" || Array.isArray(old.modules)) fail("the progress file is damaged");
  const identity={slug,languageId,commit:typeof course.commit==="string"?course.commit:null,createdAt:typeof course.createdAt==="string"?course.createdAt:null};
  const id=`course:tutor-${digest(identity).slice(0,16)}`, warnings=[...initialWarnings], cache=new Map(), answers=new Map(), orphans=new Map(), tasksByOld=new Map();
  const pack={schemaVersion:1,id,contentVersion:"1.0.0-import.pending",languageId,title:course.name??slug,preview:true,
    runner:languageId==="typescript"?{registeredLanguage:languageId,compiler:{name:"typescript",range:`=${JSON.parse(await readFile(new URL("../languages/typescript/package.json",import.meta.url),"utf8")).dependencies.typescript}`}}:{registeredLanguage:languageId,compiler:{name:".NET SDK",minimumMajor:10}},
    modules:[],lessons:[],entryPaths:[],legacy:{source:"tutor",slug,about:typeof course.about==="string"?course.about:"",createdAt:identity.createdAt,commit:identity.commit,
      parts:Array.isArray(course.parts)?course.parts.filter(part=>text(part?.id)&&text(part?.title)).map(part=>({id:part.id,title:part.title})):[],known:Array.isArray(course.known)?course.known.filter(value=>typeof value==="string"):Array.isArray(settings.known)?settings.known.filter(value=>typeof value==="string"):["TypeScript","JavaScript"]}};
  const moduleMap=new Map(), seenOld=new Set();
  let unavailableSources=0;
  for(const entry of course.modules) {
    if(!segment(entry.id) || seenOld.has(entry.id) || !text(entry.title)) fail("a module has an invalid or duplicate ID or title");
    seenOld.add(entry.id);
    const moduleId=`${id}/module/${key(entry.id)}`;
    moduleMap.set(entry.id,moduleId);
    const mod=await source.json(`${base}/modules/${entry.id}.json`);
    pack.modules.push({id:moduleId,title:entry.title,prerequisites:[],teaches:[],status:mod?"available":"planned",legacyId:entry.id,part:typeof entry.part==="string"?entry.part:null});
    if(!mod) { warnings.push(`${entry.title}: not written in Tutor yet.`); continue; }
    if(!Array.isArray(mod.stops) || !mod.stops.length || !Array.isArray(mod.quiz)) fail(`module ${entry.id} is damaged`);
    const lesson={id:moduleId,title:mod.title??entry.title,intro:text(mod.intro)?mod.intro:entry.summary??entry.title,steps:[],questions:[],examples:{},tasks:[],drills:[]};
    for(const [index,stop] of mod.stops.entries()) {
      if(!text(stop.title) || !text(stop.body)) fail(`module ${entry.id} has an incomplete explanation`);
      const exampleId=`stop-${index}`, ref=safeReference(stop,course.commit);
      lesson.examples[exampleId]=await readPinnedExcerpt(course.root,ref,cache);
      if(lesson.examples[exampleId].sourceError) unavailableSources++;
      lesson.steps.push({kind:"walkthrough",title:stop.title,text:stop.body,example:exampleId});
    }
    for(const q of mod.quiz) {
      if(!text(q.id) || !text(q.prompt) || !Array.isArray(q.choices) || !q.choices.every(text) || q.choices.length<2 || !Number.isInteger(q.answer) || !q.choices[q.answer]) fail(`module ${entry.id} has an invalid quiz question`);
      lesson.questions.push({id:key(q.id),legacyId:q.id,prompt:q.prompt+(q.code?`\n\n\`\`\`${languageId==="csharp"?"csharp":"typescript"}\n${q.code}\n\`\`\``:""),answer:q.answer,
        choices:q.choices.map(choice=>({text:choice,feedback:text(q.why)?q.why:"Review the explanation linked to this question."}))});
    }
    if(lesson.questions.length) lesson.steps.push({kind:"prediction",title:"Original Tutor quiz",text:"These are the original questions. Imported quiz scores are preserved separately from new answers.",questions:lesson.questions.map(q=>q.id)});
    const exerciseFile=await source.json(`${base}/exercises/${entry.id}.json`);
    if(exerciseFile && !Array.isArray(exerciseFile.exercises)) fail(`module ${entry.id} has a damaged exercise list`);
    for(const ex of exerciseFile?.exercises??[]) {
      const taskId=`${id}/task/${key(entry.id+"-"+ex.id)}`, task=convertTask(ex,taskId,languageId);
      if(tasksByOld.has(ex.id)) fail("exercise IDs collide across modules");
      tasksByOld.set(ex.id,task);
      if(ex.source) task.legacy.repoRef=safeReference(ex.source,course.commit);
      lesson.tasks.push(task);
      const answer=await source.read(`work/${slug}/${ex.id}/exercise.${languageId==="csharp"?"cs":"ts"}`);
      if(answer!==null) answers.set(`${taskId.split("/").at(-1)}/${languageId==="csharp"?"Exercise.cs":"Exercise.ts"}`,answer);
    }
    if(lesson.tasks.length) lesson.steps.push({kind:"independent",title:"Original Tutor practice",text:"Your saved answers are preserved. Earlier passes remain historical evidence, with no assumed independent passes.",tasks:lesson.tasks.map(task=>task.id)});
    pack.lessons.push(lesson);
  }
  if(unavailableSources) warnings.push(`${unavailableSources} pinned source excerpts are unavailable. Explanations and references are preserved. Attach a local clone after import to restore them.`);
  let work=[];
  try {
    const folder=await realpath(join(source.root,"work",slug)), rel=relative(source.root,folder);
    if(rel.startsWith("..") || isAbsolute(rel)) fail("the work folder leaves the Tutor data folder");
    work=await readdir(folder,{withFileTypes:true});
  } catch(error) { if(error.code!=="ENOENT") throw error; }
  for(const entry of work.filter(entry=>entry.isDirectory()&&segment(entry.name)&&!tasksByOld.has(entry.name))) {
    const name=`exercise.${languageId==="csharp"?"cs":"ts"}`, data=await source.read(`work/${slug}/${entry.name}/${name}`);
    if(data!==null) orphans.set(`${key(entry.name)}/${name}`,data);
  }
  if(orphans.size) warnings.push(`${orphans.size} saved answers have no readable exercise record. They will be preserved in imported history.`);
  pack.entryPaths=[{id:"beginner",start:pack.modules[0].id}];
  pack.contentVersion=`1.0.0-import.${digest(pack).slice(0,16)}`;
  validatePack(pack);
  const state=createEnrollment(pack,"beginner");
  state.legacy={last:typeof old.last?.module==="string"&&Number.isInteger(old.last.stop)?{module:old.last.module,stop:old.last.stop}:null,modules:{},preferences:{...(settings.editor==="neovim"||settings.editor==="vscode"?{editor:settings.editor}:{}),...(settings.agent==="claude"||settings.agent==="codex"?{agent:settings.agent}:{})}};
  for(const [oldId,moduleId] of moduleMap) {
    const previous=old.modules[oldId];
    if(!previous) continue;
    const evidence=moduleEvidence(previous);
    state.legacy.modules[moduleId]=evidence;
    const lesson=pack.lessons.find(lesson=>lesson.id===moduleId);
    if(lesson) state.modules[moduleId]={seen:[],questions:{}};
    // Only original stops count as read. Quizzes and exercise navigation are separate steps.
    if(lesson) state.modules[moduleId].seen=[...new Set((Array.isArray(previous.seen)?previous.seen:[]).filter(index=>Number.isInteger(index)&&index>=0&&index<Object.keys(lesson.examples).length))].sort((a,b)=>a-b);
    if(lesson && Number.isInteger(previous.stop) && previous.stop>=0 && previous.stop<Object.keys(lesson.examples).length) state.modules[moduleId].resumeStep=previous.stop;
  }
  state.legacy.unmappedModules=Object.entries(old.modules).filter(([id])=>!moduleMap.has(id)&&segment(id)).map(([id,previous])=>({id,...moduleEvidence(previous)}));
  if(state.legacy.unmappedModules.length) warnings.push(`${state.legacy.unmappedModules.length} historical module records are no longer in the outline. Their progress is preserved as imported history.`);
  for(const lesson of pack.lessons) for(const task of lesson.tasks) {
    const prior=Object.values(state.legacy.modules).map(module=>module.practice[task.legacy.id]).find(Boolean);
    const progress=newTaskProgress();
    progress.legacy=prior??{};
    progress.hintCount=0; progress.answerShown=prior?.gaveUp??false;
    // Unknown assistance is never converted into independent coding success or scheduled review.
    state.tasks[task.id]=progress;
  }
  const resume=old.last && pack.lessons.find(lesson=>lesson.id===moduleMap.get(old.last.module));
  if(resume && Number.isInteger(old.last.stop) && old.last.stop>=0 && old.last.stop<Object.keys(resume.examples).length) state.position={moduleId:resume.id,step:old.last.stop};
  validateState(state,pack);
  await source.stable();
  for(const lesson of pack.lessons) for(const task of lesson.tasks) {
    if(answers.has(`${task.id.split("/").at(-1)}/${languageId==="csharp"?"Exercise.cs":"Exercise.ts"}`)) state.tasks[task.id].assistanceUnknown=true;
  }
  const fingerprint=digest({files:source.fingerprint(),pack:digest(pack)});
  const directory=join(root,"courses",courseFolderName(id),pack.contentVersion);
  let existing=false;
  try { await readFile(join(directory,"import.json")); existing=true; } catch(error) { if(error.code!=="ENOENT") throw error; }
  if(existing) warnings.push("This content version is already imported. Existing Practice Range answers and progress will reopen unchanged.");
  const report={courseId:id,contentVersion:pack.contentVersion,slug,title:pack.title,languageId,fingerprint,alreadyImported:existing,
    modules:pack.modules.length,written:pack.lessons.length,questions:pack.lessons.reduce((n,lesson)=>n+lesson.questions.length,0),exercises:tasksByOld.size,answers:answers.size,orphanAnswers:orphans.size,warnings,
    preferences:state.legacy.preferences,known:pack.legacy.known};
  return {pack,state,answers,orphans,source,report,local:{version:1,root:course.root,name:course.name??slug,commit:course.commit,languageId},identity};
}

async function atomicJson(file,value) {
  const temporary=`${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary,jsonText(value)); await rename(temporary,file); }
  finally { await rm(temporary,{force:true}); }
}

async function destinationPath(path) {
  try { return await realpath(path); }
  catch(error) { if(error.code!=="ENOENT") throw error; return join(await destinationPath(dirname(path)),basename(path)); }
}
const inside=(parent,path)=>{const rel=relative(parent,path);return !rel.startsWith("..")&&!isAbsolute(rel);};

export async function applyTutor(root,sourceRoot,slug,expectedFingerprint) {
  const snapshot=await previewTutor(root,sourceRoot,slug);
  if(snapshot.report.fingerprint!==expectedFingerprint) fail("source files changed. Preview the import again.");
  const {pack,state,answers,orphans,source,report,local,identity}=snapshot;
  root=await destinationPath(resolve(root));
  if(inside(source.root,root)||inside(root,source.root)) fail("Tutor and Practice Range data folders must not contain each other");
  const parent=join(root,"courses",courseFolderName(pack.id));
  for(const path of [join(root,".tutor-imports"),parent]) if(!inside(root,await destinationPath(path))) fail("a destination link leaves the Practice Range data folder");
  const directory=join(parent,pack.contentVersion);
  await mkdir(join(root,".tutor-imports"),{recursive:true});
  const lock=join(root,".tutor-imports",`${pack.id.slice(6)}.lock`);
  let handle;
  try { handle=await open(lock,"wx"); }
  catch(error) {
    if(error.code!=="EEXIST") throw error;
    if(Date.now()-(await stat(lock)).mtimeMs>10*60*1000) { await rm(lock); return applyTutor(root,sourceRoot,slug,expectedFingerprint); }
    fail("another import of this course is running. Retry when it finishes. An interrupted import unlocks after ten minutes.");
  }
  const staging=join(root,".tutor-imports",randomUUID());
  try {
    if(report.alreadyImported) return {imported:report,reused:true};
    await mkdir(join(staging,pack.contentVersion),{recursive:true});
    const version=join(staging,pack.contentVersion);
    await writeFile(join(version,"pack.json"),jsonText(pack));
    await writeFile(join(version,"enrollment.json"),jsonText(state));
    await writeFile(join(version,"import.json"),jsonText({source:"tutor",identity,fingerprint:report.fingerprint,importedAt:new Date().toISOString()}));
    if(typeof local.root==="string" && isAbsolute(local.root) && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(local.commit)) await writeFile(join(version,"attachments.json"),jsonText(local));
    for(const [path,content] of answers) {
      const file=join(version,"answers",path);
      await mkdir(dirname(file),{recursive:true}); await writeFile(file,content);
    }
    for(const [path,content] of orphans) {
      const file=join(version,"history","tutor-orphans",path);
      await mkdir(dirname(file),{recursive:true}); await writeFile(file,content);
    }
    await writeFile(join(staging,"current.json"),jsonText({courseId:pack.id,contentVersion:pack.contentVersion}));
    await source.stable();
    await mkdir(join(root,"courses"),{recursive:true});
    try { await rename(staging,parent); }
    catch(error) {
      if(!["EEXIST","ENOTEMPTY"].includes(error.code)) throw error;
      const current=JSON.parse(await readFile(join(parent,"current.json"),"utf8"));
      if(current.courseId!==pack.id || !/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/.test(current.contentVersion)) fail("the existing destination cannot be identified. It was preserved.");
      const prior=JSON.parse(await readFile(join(parent,current.contentVersion,"import.json"),"utf8"));
      if(digest(prior.identity)!==digest(identity)) fail("the existing destination belongs to a different source. It was preserved.");
      // A new source revision is a separate immutable enrollment. Existing answers stay intact.
      await rename(version,directory);
      await atomicJson(join(parent,"current.json"),{courseId:pack.id,contentVersion:pack.contentVersion});
    }
    return {imported:report,reused:false};
  } finally { await rm(staging,{recursive:true,force:true}); await handle.close(); await rm(lock,{force:true}); }
}

export async function tutorImports(root,action,request) {
  const sourceRoot=typeof request.sourceRoot==="string"&&request.sourceRoot.trim()?request.sourceRoot.trim():join(dirname(root),"tutor");
  if(action==="import-list") {
    let entries;
    try { entries=await readdir(join(sourceRoot,"courses"),{withFileTypes:true}); }
    catch(error) { if(error.code==="ENOENT") return {imports:[]}; throw error; }
    const imports=[];
    for(const entry of entries.filter(entry=>entry.isDirectory()&&segment(entry.name))) {
      try { imports.push((await previewTutor(root,sourceRoot,entry.name)).report); }
      catch(error) { imports.push({slug:entry.name,title:entry.name,error:error.message}); }
    }
    return {imports};
  }
  if(action==="import-preview") return {preview:(await previewTutor(root,sourceRoot,request.slug)).report};
  if(action==="import-apply") return applyTutor(root,sourceRoot,request.slug,request.fingerprint);
  throw new Error("Unknown Tutor import action.");
}
