import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, readdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { previewTutor, applyTutor } from "../mods/practice-range/courses/importer.mjs";
import { courseCommand, enrollmentDirectory } from "../mods/practice-range/courses/service.mjs";
import { loadCourse } from "../mods/practice-range/courses/loader.mjs";
import { generateImportedModule, importedModuleContext } from "../mods/practice-range/courses/authoring.mjs";
import { cancelRequest } from "../mods/practice-range/tutor/service.mjs";

const git=(root,...args)=>execFileSync("git",["-C",root,...args],{encoding:"utf8"}).trim();
const put=async(path,value)=>{await mkdir(join(path,".."),{recursive:true});await writeFile(path,typeof value==="string"?value:JSON.stringify(value));};
const document=path=>({title:"More values",intro:"Read a stored value in the pinned sample.",sections:[{title:"The count",text:"The declaration stores a count.",references:[{path,start:1,end:1,code:"model-supplied fake code"}]}],
  questions:[{prompt:"What does the declaration store?",choices:["A count","A path"],answer:0,explanation:"The declaration names a count.",section:0}],tasks:[{checks:["must never run"]}]});
const response=doc=>({code:0,stdout:JSON.stringify({result:typeof doc==="string"?doc:JSON.stringify(doc)})});
async function fixture(t,language="typescript") {
  const root=await mkdtemp(join(tmpdir(),"herdr-author-module-"));t.after(()=>rm(root,{recursive:true,force:true}));
  const source=join(root,"tutor"),data=join(root,"data"),repo=join(root,"repo"),config=join(root,"config.json"),slug="example";
  await mkdir(repo);git(repo,"init","-q");
  const file=language==="csharp"?"Count.cs":"count.ts",code=language==="csharp"?"public record Count(int Value);":"export const count = 3;";
  await put(join(repo,file),code+"\n");git(repo,"add",".");git(repo,"-c","user.name=Fixture","-c","user.email=fixture@example.com","commit","-qm","Pinned sample");
  const commit=git(repo,"rev-parse","HEAD");
  await put(join(source,"courses",slug,"course.json"),{name:"Sample repo",root:repo,commit,language,known:["Python"],modules:[{id:"01-values",title:"Values"},{id:"02-more",title:"More values"},{id:"03-next",title:"Next values"}]});
  await put(join(source,"courses",slug,"modules/01-values.json"),{title:"Values",intro:"A value.",stops:[{title:"Count",body:"Read the count.",file,start:1,end:1}],quiz:[{id:"q1",prompt:"What is it?",choices:["Count","Path"],answer:0,why:"It is a count."}]});
  const solution=language==="csharp"?'System.Console.WriteLine(3);':'console.log(3);';
  await put(join(source,"courses",slug,"exercises/01-values.json"),{exercises:[{id:"01-print",title:"Print",kind:"program",prompt:"Print three.",starter:"// Your answer\n",solution,expected:"3",concept:"Values"}]});
  await put(join(source,"courses",slug,"progress.json"),{modules:{"01-values":{seen:[0],practice:{"01-print":{runs:2,passed:true,hints:1}}}},last:{module:"01-values",stop:0}});
  await put(join(source,"work",slug,`01-print/exercise.${language==="csharp"?"cs":"ts"}`),solution+" // saved work\n");
  await put(config,{tutor:{enabled:true,provider:"claude"}});
  const preview=await previewTutor(data,source,slug);await applyTutor(data,source,slug,preview.report.fingerprint);
  const pack=await loadCourse(preview.pack.id,preview.pack.contentVersion,data),directory=enrollmentDirectory(data,pack),parent=join(directory,"..");
  const request={id:"write-module",courseId:pack.id,contentVersion:pack.contentVersion,moduleId:pack.modules[1].id};
  return {root,source,data,repo,config,file,code,commit,pack,directory,parent,request};
}
const versions=async f=>(await readdir(f.parent,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();

test("unfinished Tutor modules become immutable new versions with preserved work and pinned reading/quiz content",async t=>{
  const f=await fixture(t),task=f.pack.lessons[0].tasks[0];
  let state=await courseCommand(f.data,"task",{courseId:f.pack.id,taskId:task.id});
  await courseCommand(f.data,"hint",{courseId:f.pack.id,taskId:task.id});
  await put(join(f.directory,"answers","cache","node_modules","ignored.js"),"cache");
  await put(join(f.directory,"history","manual.txt"),"keep this backup");
  const originalPack=await readFile(join(f.directory,"pack.json"),"utf8"), before=await readFile(join(f.directory,"enrollment.json"),"utf8");
  let captured,calls=0;
  const result=await generateImportedModule(f.data,f.config,f.request,{run:async (_provider,args,options)=>{
    calls++;captured=JSON.parse(options.input);
    assert.match(args[args.indexOf("--system-prompt")+1],/Never supply tasks/);
    assert.equal(args[args.indexOf("--tools")+1],"");
    assert.equal(options.input.includes(f.root),false);
    assert.equal(options.input.includes("saved work"),false);
    assert.equal(options.input.includes("Original Tutor practice"),false);
    // A newer HEAD and dirty work must not change the imported course's pinned source.
    await put(join(f.repo,f.file),"export const changed = 99;\n");git(f.repo,"add",".");git(f.repo,"-c","user.name=Fixture","-c","user.email=fixture@example.com","commit","-qm","Newer HEAD");
    await courseCommand(f.data,"attach-repo",{courseId:f.pack.id,path:f.repo});
    await put(join(f.repo,f.file),"dirty source");
    return response(document(f.file));
  }});
  assert.deepEqual(captured.knownLanguages,["Python"]);assert.equal(captured.repository.commit,f.commit);
  assert.match(result.generated.contentVersion,/generated\./);assert.equal(result.reused,false);
  assert.equal(await readFile(join(f.directory,"pack.json"),"utf8"),originalPack);
  assert.equal(await readFile(join(f.directory,"enrollment.json"),"utf8"),before);
  assert.equal(JSON.parse(await readFile(join(f.parent,"current.json"),"utf8")).contentVersion,f.pack.contentVersion,"Publication does not select the new version");
  const next=await loadCourse(f.pack.id,result.generated.contentVersion,f.data),lesson=next.lessons.find(lesson=>lesson.id===f.request.moduleId);
  assert.equal(lesson.generated.commit,f.commit);assert.equal(lesson.tasks.length,0);assert.equal(lesson.examples["source-0-0"].code,f.code);
  assert.equal(JSON.stringify(next).includes("must never run"),false);assert.equal(next.modules[1].generated,true);assert.equal(next.modules[2].status,"planned");
  const nextDirectory=enrollmentDirectory(f.data,next);
  const carried=JSON.parse(await readFile(join(nextDirectory,"enrollment.json"),"utf8"));
  assert.deepEqual({...carried,contentVersion:f.pack.contentVersion},JSON.parse(before));
  assert.equal(await readFile(join(nextDirectory,"answers",task.id.split("/").at(-1),"Exercise.ts"),"utf8"),await readFile(state.file,"utf8"));
  assert.equal(await readFile(join(nextDirectory,"history/manual.txt"),"utf8"),"keep this backup");
  await assert.rejects(readFile(join(nextDirectory,"answers/cache/node_modules/ignored.js")),{code:"ENOENT"});
  await courseCommand(f.data,"enroll",result.generated);
  state=await courseCommand(f.data,"open",{...result.generated,step:0});
  assert.equal(state.enrollment.position.moduleId,f.request.moduleId);
  const quiz=lesson.questions[0];
  state=await courseCommand(f.data,"question",{...result.generated,questionId:quiz.id,choice:0});
  assert.equal(state.enrollment.modules[lesson.id].questions[quiz.id].correct,true);
  assert.equal(state.enrollment.tasks[task.id].independentPasses,0);
  await courseCommand(f.data,"detach-repo",result.generated);
  const source=await courseCommand(f.data,"source",{...result.generated,exampleId:"source-0-0"});
  assert.equal(source.source.code,f.code);assert.match(source.source.detail,/saved excerpt/);
  const changed=await readFile(join(nextDirectory,"enrollment.json"),"utf8");
  const reused=await generateImportedModule(f.data,f.config,f.request,{run:async()=>{calls++;throw new Error("Must reuse");}});
  assert.equal(reused.reused,true);assert.equal(calls,1);assert.equal(reused.generated.contentVersion,next.contentVersion);
  assert.equal(await readFile(join(nextDirectory,"enrollment.json"),"utf8"),changed);
  assert.equal(await readFile(join(f.repo,f.file),"utf8"),"dirty source");
  assert.deepEqual(await readdir(join(f.data,".course-authoring")),[]);
});

test("malformed or unsupported generated content leaves imported packs, answers and progress unchanged",async t=>{
  const f=await fixture(t),before=await versions(f),original=await readFile(join(f.directory,"enrollment.json"),"utf8");
  const invalid=["not JSON",{status:"insufficient-source",reason:"The sample has no relevant code."},
    {...document(f.file),sections:[{title:"Fake",text:"Fake",references:[{path:"../secret",start:1,end:1}]}]},
    {...document(f.file),questions:[{...document(f.file).questions[0],answer:99}]},
    {...document(f.file),questions:[{...document(f.file).questions[0],section:-1}]},
    {...document(f.file),questions:[{...document(f.file).questions[0],choices:["same","Same"]}]}];
  for(const doc of invalid) {
    await assert.rejects(generateImportedModule(f.data,f.config,f.request,{run:async()=>response(doc)}));
    assert.deepEqual(await versions(f),before);assert.equal(await readFile(join(f.directory,"enrollment.json"),"utf8"),original);
  }
  await assert.rejects(generateImportedModule(f.data,f.config,{...f.request,moduleId:f.pack.modules[0].id},{run:async()=>{throw new Error("Must not run");}}),/unfinished/);
});

test("cancellation, provider failure and unavailable original commits do not publish course versions",async t=>{
  const f=await fixture(t),before=await versions(f);
  await assert.rejects(generateImportedModule(f.data,f.config,f.request,{run:async()=>{await cancelRequest(f.data,f.request.id);return response(document(f.file));}}),/cancelled/);
  await assert.rejects(generateImportedModule(f.data,f.config,f.request,{run:async()=>({code:1,problem:"account unavailable"})}),/account unavailable/);
  await courseCommand(f.data,"detach-repo",{courseId:f.pack.id});
  await assert.rejects(generateImportedModule(f.data,f.config,f.request,{run:async()=>{throw new Error("Must not run");}}),/pinned commit/);
  assert.deepEqual(await versions(f),before);
});

test("publication rejects changed work, interrupted copies and symbolic links without leaving partial versions",async t=>{
  const f=await fixture(t),context=await importedModuleContext(f.data,f.pack,f.directory,f.request),before=await versions(f);
  const request={...f.request,contextHash:createHash("sha256").update(JSON.stringify(context)).digest("hex"),document:document(f.file)};
  await put(join(f.directory,"history/one.txt"),"original backup");
  let calls=0;
  await assert.rejects(courseCommand(f.data,"publish-module",request,{ensureActive:async()=>{if(++calls===2)throw new Error("Tutor request cancelled.");}}),/cancelled/);
  calls=0;
  await assert.rejects(courseCommand(f.data,"publish-module",request,{ensureActive:async()=>{if(++calls===3)await put(join(f.directory,"history/one.txt"),"new backup");}}),/work changed/);
  await symlink(join(f.repo,f.file),join(f.directory,"history/linked.ts"));
  await assert.rejects(courseCommand(f.data,"publish-module",request),/symbolic link/);
  assert.deepEqual(await versions(f),before);assert.deepEqual(await readdir(join(f.data,".course-authoring")),[]);
  assert.equal(await readFile(join(f.directory,"history/one.txt"),"utf8"),"new backup");
});

test("C# imported modules use the same reading/quiz authoring flow without model-supplied checks",async t=>{
  const f=await fixture(t,"csharp");
  const result=await generateImportedModule(f.data,f.config,f.request,{run:async()=>response(document(f.file))});
  const pack=await loadCourse(f.pack.id,result.generated.contentVersion,f.data);
  assert.equal(pack.languageId,"csharp");assert.equal(pack.lessons[1].examples["source-0-0"].code,f.code);assert.equal(pack.lessons[1].tasks.length,0);
});

test("switching course versions while a provider runs preserves the newly selected version",async t=>{
  const f=await fixture(t);
  const first=await generateImportedModule(f.data,f.config,f.request,{run:async()=>response(document(f.file))});
  const before=await versions(f);
  await assert.rejects(generateImportedModule(f.data,f.config,{...f.request,moduleId:f.pack.modules[2].id},{run:async()=>{
    await courseCommand(f.data,"enroll",first.generated);return response(document(f.file));
  }}),/selected course version changed/);
  assert.deepEqual(await versions(f),before);
  assert.equal(JSON.parse(await readFile(join(f.parent,"current.json"),"utf8")).contentVersion,first.generated.contentVersion);
});
