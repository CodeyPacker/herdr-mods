import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink, utimes, rename } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { previewTutor, applyTutor } from "../mods/practice-range/courses/importer.mjs";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";
import { saveImportedPreferences } from "../mods/practice-range/courses/import-preferences.js";
import { courseFolderName } from "../mods/practice-range/courses/loader.mjs";

const write=async(file,value)=>{ await mkdir(join(file,".."),{recursive:true}); await writeFile(file,typeof value==="string"?value:JSON.stringify(value)); };
const git=(root,...args)=>execFileSync("git",["-C",root,...args],{encoding:"utf8"}).trim();
async function fixture(t,language="typescript") {
  const root=await mkdtemp(join(tmpdir(),"herdr-tutor-import-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const source=join(root,"tutor"), target=join(root,"practice-range"), repo=join(root,"repo"), slug=`sample-${language}`;
  await mkdir(repo); git(repo,"init","-q");
  const file=language==="csharp"?"Board.cs":"board.ts";
  await write(join(repo,file),language==="csharp"?'public record Board(int Count);\n':'export const count = 3;\n');
  git(repo,"add","."); git(repo,"-c","user.name=Fixture","-c","user.email=fixture@example.com","commit","-qm","Add teaching example");
  const commit=git(repo,"rev-parse","HEAD"), base=join(source,"courses",slug);
  const reference={file,start:1,end:1,anchor:language==="csharp"?"record Board":"count"};
  await write(join(source,"settings.json"),{editor:"vscode",agent:"claude",known:["Python"],secret:"must not copy"});
  await write(join(base,"course.json"),{version:1,name:"Example repo",root:repo,commit,language,createdAt:"2026-01-01T00:00:00Z",about:"A small example",known:["Python"],parts:[{id:"core",title:"Core"}],modules:[{id:"01-values",part:"core",title:"Values",summary:"Learn values"},{id:"02-more",part:"core",title:"More",summary:"Not written"}]});
  await write(join(base,"modules/01-values.json"),{id:"01-values",title:"Values",intro:"Read the real code.",stops:[{title:"A value",body:"This code stores one count.",...reference}],quiz:[{id:"q1",prompt:"What is the count?",code:"const count = 3;",choices:["Three","Four"],answer:0,why:"The initial value is three.",stop:0}]});
  const type=language==="csharp"?"types":"checks";
  const solution=language==="csharp"?"public record Point(int X, int Y);":"function add(a: number, b: number): number { return a + b; }";
  const checks=language==="csharp"?'Check("x", new Point(2, 3).X == 2);\nCheck("y", new Point(2, 3).Y == 3); // original comment':'check("adds", add(2, 3) === 5);\ncheck("zero", add(-2, 2) === 0); // original comment';
  const print=language==="csharp"?'using System;\nConsole.WriteLine("  ready");':'console.log("  ready");';
  await write(join(base,"exercises/01-values.json"),{module:"01-values",exercises:[{id:"01-sum",title:"A small type",kind:type,prompt:language==="csharp"?"Declare Point with integer X and Y.":"Write add(a, b).",starter:"// Write your answer here.\n",solution,checks,concept:"Values",source:reference},{id:"01-print",title:"Print text",kind:"program",prompt:"Print two spaces then ready.",starter:"// Print the text.\n",solution:print,expected:"  ready\n",concept:"Output",source:reference}]});
  await write(join(base,"progress.json"),{version:1,last:{module:"01-values",stop:0},modules:{"01-values":{seen:[0],stop:0,doneAt:"2026-01-02T00:00:00Z",quiz:{attempts:2,best:1,last:1,passed:true,missed:[],at:"2026-01-02T00:00:00Z"},practice:{"01-sum":{passed:true,runs:4,hints:2,gaveUp:false},"01-print":{passed:true,runs:1,hints:0,gaveUp:false}}}}});
  const progress=JSON.parse(await readFile(join(base,"progress.json"),"utf8"));
  progress.modules["99-retired"]={seen:[2],stop:2,doneAt:"2025-12-01",quiz:{best:3,passed:true},practice:{"99-orphan":{runs:2,passed:true}}};
  await write(join(base,"progress.json"),progress);
  const extension=language==="csharp"?"cs":"ts";
  await write(join(source,"work",slug,"01-sum",`exercise.${extension}`),solution);
  await write(join(source,"work",slug,"01-print",`exercise.${extension}`),print);
  await write(join(source,"work",slug,"99-orphan",`exercise.${extension}`),"// Preserve this unmatched answer.\n");
  return {root,source,target,base,repo,slug,solution,print,extension};
}

test("Tutor preview is read-only and import preserves course order, quizzes, historical evidence and saved answers",async t=>{
  const f=await fixture(t), original=await readFile(join(f.base,"progress.json"),"utf8");
  const preview=await previewTutor(f.target,f.source,f.slug);
  assert.equal(preview.report.modules,2); assert.equal(preview.report.written,1);
  assert.equal(preview.report.answers,2); assert.equal(preview.report.orphanAnswers,1);
  await assert.rejects(readdir(f.target),{code:"ENOENT"});
  assert.deepEqual(preview.report.known,["Python"]);
  const result=await applyTutor(f.target,f.source,f.slug,preview.report.fingerprint);
  assert.equal(result.reused,false);
  const history=join(f.target,"courses",courseFolderName(preview.pack.id),preview.pack.contentVersion,"history","tutor-orphans");
  const [orphan]=await readdir(history);
  assert.equal(await readFile(join(history,orphan,"exercise.ts"),"utf8"),"// Preserve this unmatched answer.\n");
  let state=await courseCommand(f.target,"status",{courseId:preview.pack.id});
  assert.deepEqual(state.course.modules.map(module=>module.title),["Values","More"]);
  assert.equal(state.course.modules[1].status,"planned");
  assert.equal(state.course.lessons[0].questions[0].choices[0].text,"Three");
  assert.match(state.course.lessons[0].examples["stop-0"].code,/count = 3/);
  assert.equal(state.enrollment.position.step,0);
  const moduleId=state.course.modules[0].id;
  assert.equal(state.enrollment.legacy.modules[moduleId].quiz.best,1);
  assert.equal(state.enrollment.legacy.modules[moduleId].doneAt,"2026-01-02T00:00:00Z");
  assert.equal(state.enrollment.modules[moduleId].resumeStep,0);
  assert.equal(state.enrollment.legacy.unmappedModules[0].id,"99-retired");
  assert.equal(state.enrollment.legacy.unmappedModules[0].quiz.best,3);
  assert.deepEqual(state.enrollment.legacy.unmappedModules[0].seen,[2]);
  const task=preview.pack.lessons[0].tasks[0];
  state=await courseCommand(f.target,"task",{courseId:preview.pack.id,taskId:task.id});
  assert.equal(await readFile(state.file,"utf8"),f.solution);
  assert.equal(state.enrollment.tasks[task.id].independentPasses,0);
  assert.equal(state.enrollment.tasks[task.id].legacy.hints,2);
  state=await courseCommand(f.target,"check",{courseId:preview.pack.id,taskId:task.id});
  assert.equal(state.enrollment.tasks[task.id].result.passed,true);
  assert.equal(state.enrollment.tasks[task.id].independentPasses,0,"Imported answers cannot establish independent success");
  await courseCommand(f.target,"reset",{courseId:preview.pack.id,taskId:task.id});
  await writeFile(state.file,f.solution);
  state=await courseCommand(f.target,"check",{courseId:preview.pack.id,taskId:task.id});
  assert.equal(state.enrollment.tasks[task.id].independentPasses,1);
  const program=preview.pack.lessons[0].tasks[1];
  state=await courseCommand(f.target,"task",{courseId:preview.pack.id,taskId:program.id});
  state=await courseCommand(f.target,"check",{courseId:preview.pack.id,taskId:program.id});
  assert.equal(state.enrollment.tasks[program.id].result.passed,true);
  await writeFile(state.file,'console.log("ready");');
  state=await courseCommand(f.target,"check",{courseId:preview.pack.id,taskId:program.id});
  assert.equal(state.enrollment.tasks[program.id].result.passed,false);
  assert.equal(await readFile(join(f.base,"progress.json"),"utf8"),original);
  assert.equal((await courseCommand(f.target,"list")).courses.some(course=>course.id===preview.pack.id),true);
  assert.doesNotMatch(JSON.stringify(state.course),/must not copy/);
});

test("Tutor preference opt-in fills missing fields, preserves explicit choices, and uses the original write guard",async()=>{
  let text='{"sync":true,"layout":{"side":"right"}}';
  const io={read:async()=>text,write:async(next,expected)=>{assert.equal(expected,text);text=next;}};
  await saveImportedPreferences({editor:"vscode",agent:"claude",secret:"never copy"},io);
  assert.deepEqual(JSON.parse(text),{sync:true,layout:{side:"right"},editor:"vscode",tutor:{enabled:true,provider:"claude"}});
  text='{"editor":null,"tutor":{"enabled":false}}';
  assert.deepEqual(await saveImportedPreferences({editor:"neovim",agent:"codex"},io),[]);
  assert.deepEqual(JSON.parse(text),{editor:null,tutor:{enabled:false}});
  text="{}";
  await assert.rejects(saveImportedPreferences({editor:"neovim"},{read:async()=>text,write:async()=>{throw new Error("configuration changed");}}),/configuration changed/);
  assert.equal(text,"{}");
});

test("imported TypeScript keeps Tutor's DOM library without exposing it to regular practice",async t=>{
  const f=await fixture(t), file=join(f.base,"exercises/01-values.json");
  const exercises=JSON.parse(await readFile(file,"utf8"));
  exercises.exercises[0].solution+='\nconst address = new URL("https://example.test/path");';
  exercises.exercises[0].checks+='\ncheck("url", address.hostname === "example.test");';
  await write(file,exercises);
  await write(join(f.source,"work",f.slug,"01-sum/exercise.ts"),exercises.exercises[0].solution);
  const preview=await previewTutor(f.target,f.source,f.slug);
  await applyTutor(f.target,f.source,f.slug,preview.report.fingerprint);
  const id=preview.pack.id, task=preview.pack.lessons[0].tasks[0];
  let state=await courseCommand(f.target,"task",{courseId:id,taskId:task.id});
  const options=JSON.parse(await readFile(join(state.folder,"tsconfig.json"),"utf8")).compilerOptions;
  assert.deepEqual(options.lib,["ES2023","DOM"]);
  assert.equal(options.moduleDetection,"force");
  state=await courseCommand(f.target,"check",{courseId:id,taskId:task.id});
  assert.equal(state.enrollment.tasks[task.id].result.passed,true,JSON.stringify(state.enrollment.tasks[task.id].result));
  const core="course:ts-foundations", coreTask=`${core}/task/remaining`;
  await courseCommand(f.target,"enroll",{courseId:core});
  state=await courseCommand(f.target,"task",{courseId:core,taskId:coreTask});
  await writeFile(state.file,'let remaining = opening - change;\nconst address = new URL("https://example.test");');
  state=await courseCommand(f.target,"check",{courseId:core,taskId:coreTask});
  assert.equal(state.enrollment.tasks[coreTask].result.passed,false);
  assert.match(state.enrollment.tasks[coreTask].result.details.join("\n"),/TS2304/);
});

test("repeated import preserves newer destination work and changed source revisions get separate enrollments",async t=>{
  const f=await fixture(t);
  let preview=await previewTutor(f.target,f.source,f.slug);
  await applyTutor(f.target,f.source,f.slug,preview.report.fingerprint);
  const id=preview.pack.id, task=preview.pack.lessons[0].tasks[0];
  let state=await courseCommand(f.target,"task",{courseId:id,taskId:task.id});
  await writeFile(state.file,"// Newer Practice Range work.\n");
  const firstFile=state.file;
  preview=await previewTutor(f.target,f.source,f.slug);
  assert.equal((await applyTutor(f.target,f.source,f.slug,preview.report.fingerprint)).reused,true);
  assert.equal(await readFile(firstFile,"utf8"),"// Newer Practice Range work.\n");
  const module=JSON.parse(await readFile(join(f.base,"modules/01-values.json"),"utf8"));
  module.intro="A revised lesson."; await write(join(f.base,"modules/01-values.json"),module);
  await assert.rejects(applyTutor(f.target,f.source,f.slug,preview.report.fingerprint),/source files changed/);
  const revised=await previewTutor(f.target,f.source,f.slug);
  assert.equal(revised.pack.id,id); assert.notEqual(revised.pack.contentVersion,preview.pack.contentVersion);
  await applyTutor(f.target,f.source,f.slug,revised.report.fingerprint);
  state=await courseCommand(f.target,"status",{courseId:id});
  assert.equal(state.course.contentVersion,revised.pack.contentVersion);
  assert.equal(await readFile(firstFile,"utf8"),"// Newer Practice Range work.\n");
});

test("missing repo, malformed courses and interrupted staging do not damage Tutor data",async t=>{
  const f=await fixture(t);
  await rm(f.repo,{recursive:true,force:true});
  const preview=await previewTutor(f.target,f.source,f.slug);
  assert.match(preview.pack.lessons[0].examples["stop-0"].sourceError,/unavailable/);
  await mkdir(join(f.target,".tutor-imports","interrupted"),{recursive:true});
  await write(join(f.target,".tutor-imports","interrupted","partial"),"incomplete");
  const lock=join(f.target,".tutor-imports",`${preview.pack.id.slice(6)}.lock`);
  await write(lock,""); await utimes(lock,new Date(0),new Date(0));
  await applyTutor(f.target,f.source,f.slug,preview.report.fingerprint);
  await write(join(f.source,"courses/broken/course.json"),"{broken");
  const list=await courseCommand(f.target,"import-list",{sourceRoot:f.source});
  assert.equal(list.imports.length,2);
  assert.match(list.imports.find(course=>course.slug==="broken").error,/damaged/);
  await write(join(f.base,"progress.json"),"{broken");
  await assert.rejects(previewTutor(f.target,f.source,f.slug),/progress.json is damaged/);
  assert.equal(await readFile(join(f.base,"progress.json"),"utf8"),"{broken");
});

test("source links cannot import files outside the chosen Tutor data folder",async t=>{
  const f=await fixture(t), file=join(f.source,"work",f.slug,"01-sum","exercise.ts");
  await rm(file); await write(join(f.root,"outside.ts"),"private source");
  await symlink(join(f.root,"outside.ts"),file);
  await assert.rejects(previewTutor(f.target,f.source,f.slug),/leaves the Tutor data folder/);
  await assert.rejects(readdir(f.target),{code:"ENOENT"});
});

test("attaching a moved clone restores missing pinned excerpts without rewriting imported content",async t=>{
  const f=await fixture(t), moved=join(f.root,"moved-clone");
  await rename(f.repo,moved);
  const preview=await previewTutor(f.target,f.source,f.slug);
  assert.ok(preview.pack.lessons[0].examples["stop-0"].sourceError);
  await applyTutor(f.target,f.source,f.slug,preview.report.fingerprint);
  const state=await courseCommand(f.target,"attach-repo",{courseId:preview.pack.id,path:moved});
  assert.equal(state.course.lessons[0].examples["stop-0"].sourceError,undefined);
  assert.match(state.course.lessons[0].examples["stop-0"].code,/count = 3/);
  const stored=JSON.parse(await readFile(join(f.target,"courses",courseFolderName(preview.pack.id),preview.pack.contentVersion,"pack.json"),"utf8"));
  assert.ok(stored.lessons[0].examples["stop-0"].sourceError,"Immutable imported content is preserved");
  assert.equal(state.course.contentVersion,preview.pack.contentVersion);
});

test("import cannot write into Tutor or through an external destination link",async t=>{
  const f=await fixture(t), preview=await previewTutor(f.target,f.source,f.slug);
  await assert.rejects(applyTutor(join(f.source,"nested"),f.source,f.slug,preview.report.fingerprint),/must not contain each other/);
  await mkdir(f.target,{recursive:true});
  await symlink(f.source,join(f.target,".tutor-imports"));
  await assert.rejects(applyTutor(f.target,f.source,f.slug,preview.report.fingerprint),/destination link leaves/);
  assert.equal((await readdir(f.source)).some(name=>name.endsWith(".lock")),false);
});

test("C# Tutor types and complete programs execute through the registered checker",{timeout:120000},async t=>{
  const f=await fixture(t,"csharp"), preview=await previewTutor(f.target,f.source,f.slug);
  await applyTutor(f.target,f.source,f.slug,preview.report.fingerprint);
  for(const task of preview.pack.lessons[0].tasks) {
    let state=await courseCommand(f.target,"task",{courseId:preview.pack.id,taskId:task.id});
    const config=await readFile(join(state.folder,"Practice.csproj"),"utf8");
    assert.match(config,/<ImplicitUsings>enable/);
    assert.match(config,new RegExp(`<OutputType>${task.legacy.kind==="program"?"Exe":"Library"}`));
    state=await courseCommand(f.target,"check",{courseId:preview.pack.id,taskId:task.id});
    assert.equal(state.enrollment.tasks[task.id].result.passed,true,JSON.stringify(state.enrollment.tasks[task.id].result));
    if(task.legacy.kind==="program") {
      await writeFile(state.file,'Console.WriteLine("ready");');
      state=await courseCommand(f.target,"check",{courseId:preview.pack.id,taskId:task.id});
      assert.equal(state.enrollment.tasks[task.id].result.passed,false,"Leading spaces must be preserved");
      await writeFile(state.file,'string text = null; Console.WriteLine(text);');
      state=await courseCommand(f.target,"check",{courseId:preview.pack.id,taskId:task.id});
      assert.match(state.enrollment.tasks[task.id].result.details.join("\n"),/CS8600/);
    }
  }
});
