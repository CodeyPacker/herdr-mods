import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand, enrollmentDirectory } from "../mods/practice-range/courses/service.mjs";
import { loadCourse } from "../mods/practice-range/courses/loader.mjs";
import { generateRepoLesson } from "../mods/practice-range/courses/supplements.mjs";
import { readRepoSource } from "../mods/practice-range/courses/repo.mjs";

const courseId="course:ts-foundations", moduleId=`${courseId}/module/values`;
const git=(folder,...args)=>execFileSync("git",["-C",folder,...args],{encoding:"utf8"}).trim();
async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),"herdr-source-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const repo=join(root,"repo"), data=join(root,"data"), config=join(root,"config.json");
  await mkdir(repo);
  git(repo,"init","-q");
  const code=Array.from({length:300},(_,index)=>`export const value${index+1} = ${index+1};`).join("\n");
  await writeFile(join(repo,"δ.ts"),code);
  git(repo,"add",".");git(repo,"-c","user.name=Fixture","-c","user.email=fixture@example.com","commit","-qm","Source");
  const commit=git(repo,"rev-parse","HEAD");
  await writeFile(config,JSON.stringify({tutor:{enabled:true,provider:"claude"}}));
  await courseCommand(data,"enroll",{courseId});
  await courseCommand(data,"attach-repo",{courseId,path:repo});
  const state=await generateRepoLesson(data,config,{id:"source-fixture",courseId,moduleId},{run:async()=>({code:0,stdout:JSON.stringify({result:JSON.stringify({title:"Values",sections:[{title:"Two values",text:"These exports store numbers.",references:[{path:"δ.ts",start:150,end:151}]}]})})})});
  const request={courseId,repoLessonId:state.repoLessons.lessons[0].id,sectionIndex:0,referenceIndex:0};
  return {repo,data,commit,request,code};
}

test("source navigation reads pinned full-file pages without changing learner evidence or dirty files",async t=>{
  const f=await fixture(t);
  await writeFile(join(f.repo,"δ.ts"),"newer committed content");
  git(f.repo,"add",".");git(f.repo,"-c","user.name=Fixture","-c","user.email=fixture@example.com","commit","-qm","Newer source");
  const head=git(f.repo,"rev-parse","HEAD");
  await writeFile(join(f.repo,"δ.ts"),"dirty working tree");
  const dirty=git(f.repo,"status","--porcelain"), before=(await courseCommand(f.data,"status",{courseId})).enrollment;
  const run=value=>courseCommand(f.data,"source",{...f.request,...value});
  let {source}=await run({});
  assert.equal(source.start,130);assert.equal(source.end,249);assert.equal(source.total,300);
  assert.equal(source.commit,f.commit);assert.equal(source.path,"δ.ts");
  assert.match(source.code,/value150 = 150/);assert.doesNotMatch(source.code,/dirty/);
  assert.equal(source.referenceStart,150);assert.equal(source.referenceEnd,151);
  ({source}=await run({line:source.next}));
  assert.equal(source.start,250);assert.equal(source.end,300);assert.equal(source.next,null);
  ({source}=await run({line:source.previous}));
  assert.equal(source.start,130);
  ({source}=await run({line:99999}));
  assert.equal(source.start,300);assert.match(source.code,/value300 = 300/);
  assert.deepEqual((await courseCommand(f.data,"status",{courseId})).enrollment,before);
  assert.equal(git(f.repo,"status","--porcelain"),dirty);
  assert.equal(git(f.repo,"rev-parse","HEAD"),head);
});

test("source requests resolve enrolled references and reject invalid selectors and line numbers",async t=>{
  const f=await fixture(t);
  for(const value of [{repoLessonId:"missing"},{sectionIndex:-1},{referenceIndex:1},{line:0},{line:1.5},{line:"1"}])
    await assert.rejects(courseCommand(f.data,"source",{...f.request,...value}),/Choose/);
  await assert.rejects(courseCommand(f.data,"source",{courseId,moduleId,exampleId:"board",path:"../secret",commit:f.commit}),/Choose a saved source reference/);
  const {source}=await courseCommand(f.data,"source",{...f.request,path:"../secret",commit:"b".repeat(40)});
  assert.equal(source.path,"δ.ts");assert.equal(source.commit,f.commit);
});

test("source navigation keeps saved excerpts after detaching and bounds oversized or binary files",async t=>{
  const f=await fixture(t);
  await courseCommand(f.data,"detach-repo",{courseId});
  let {source}=await courseCommand(f.data,"source",f.request);
  assert.match(source.detail,/saved excerpt/);
  assert.equal(source.start,150);assert.equal(source.end,151);assert.equal(source.total,null);
  assert.equal(source.code,"export const value150 = 150;\nexport const value151 = 151;");
  await writeFile(join(f.repo,"big.ts"),"x".repeat(256001));
  await writeFile(join(f.repo,"binary.ts"),"binary\0content");
  git(f.repo,"add",".");git(f.repo,"-c","user.name=Fixture","-c","user.email=fixture@example.com","commit","-qm","Bounded sources");
  const commit=git(f.repo,"rev-parse","HEAD");
  await courseCommand(f.data,"attach-repo",{courseId,path:f.repo});
  const directory=enrollmentDirectory(f.data,await loadCourse(courseId));
  for(const path of ["big.ts","binary.ts","missing.ts"]) {
    source=await readRepoSource(directory,{path,commit,start:1,end:1},null);
    assert.match(source.detail,/No saved excerpt/);assert.equal(source.code,"");assert.equal(source.next,null);
  }
  await assert.rejects(readRepoSource(directory,{path:"δ.ts",commit:"--help",start:1,end:1},null),/Invalid source reference/);
});
