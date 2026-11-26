import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand, enrollmentDirectory } from "../mods/practice-range/courses/service.mjs";
import { loadCourse } from "../mods/practice-range/courses/loader.mjs";
import { repositoryContext } from "../mods/practice-range/courses/repo.mjs";
import { courseTutorContext } from "../mods/practice-range/courses/help.mjs";

const courseId = "course:ts-foundations";
const git = (root, ...args) => execFileSync("git", ["-C",root,...args], {encoding:"utf8"}).trim();
async function repo(folder, files) {
  await mkdir(folder,{recursive:true});
  git(folder,"init","-q");
  for(const [path,text] of Object.entries(files)) { await mkdir(join(folder,path,".."),{recursive:true}); await writeFile(join(folder,path),text); }
  git(folder,"add",".");
  git(folder,"-c","user.name=Fixture","-c","user.email=fixture@example.com","commit","-qm","Add local course example");
  return git(folder,"rev-parse","HEAD");
}

test("repo questions use pinned source, preserve dirty files, and fall back when the local attachment disappears", async t => {
  const root = await mkdtemp(join(tmpdir(),"herdr-course-repo-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const folder = join(root,"learner's repo"), data = join(root,"data");
  const commit = await repo(folder,{"src/δ.ts":"export const count = 1;\n"});
  await writeFile(join(folder,"src/δ.ts"),"export const count = 2;\n");
  const before = git(folder,"status","--porcelain");
  await courseCommand(data,"enroll",{courseId});
  let state = await courseCommand(data,"attach-repo",{courseId,path:folder});
  assert.equal(state.attachment.commit,commit);
  assert.equal(state.attachment.available,true);
  const directory = enrollmentDirectory(data,await loadCourse(courseId));
  const context = await repositoryContext(directory);
  assert.equal(context.files[0].path,"src/δ.ts");
  assert.match(context.files[0].code,/count = 1/);
  assert.doesNotMatch(JSON.stringify(context),new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.equal(git(folder,"status","--porcelain"),before);
  assert.equal(git(folder,"rev-parse","HEAD"),commit);
  await courseCommand(data,"open",{courseId,moduleId:`${courseId}/module/values`,step:0});
  const help = await courseTutorContext(data,{courseId,moduleId:`${courseId}/module/values`,step:0,question:"How does this repo use variables?"});
  assert.equal(help.repository.commit,commit);
  const other = join(root,"other");
  await repo(other,{"main.py":"count = 1\n"});
  await assert.rejects(courseCommand(data,"attach-repo",{courseId,path:other}),/no typescript source/);
  assert.equal((await courseCommand(data,"status",{courseId})).attachment.commit,commit,"A failed replacement preserves the prior attachment");
  await rename(folder,join(root,"moved"));
  state = await courseCommand(data,"status",{courseId});
  assert.equal(state.attachment.available,false);
  assert.equal(state.course.lessons.length,18);
  assert.equal((await repositoryContext(directory)).available,false);
  state = await courseCommand(data,"detach-repo",{courseId});
  assert.equal(state.attachment,null);
  assert.equal(state.enrollment.position.step,0);
});

test("repo excerpts are bounded and a damaged attachment cannot break the bundled course", async t => {
  const root=await mkdtemp(join(tmpdir(),"herdr-course-repo-limit-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const folder=join(root,"repo"),data=join(root,"data");
  const files={};
  for(let i=0;i<20;i++) files[`file${String(i).padStart(2,"0")}.ts`]=Array.from({length:200},(_,line)=>`// file ${i} line ${line} ${"x".repeat(50)}`).join("\n");
  files["00-too-large.ts"]="x".repeat(140000);
  await repo(folder,files);
  await courseCommand(data,"enroll",{courseId});
  await courseCommand(data,"attach-repo",{courseId,path:folder});
  const directory=enrollmentDirectory(data,await loadCourse(courseId));
  const context=await repositoryContext(directory);
  assert.ok(context.files.length<=16);
  assert.ok(context.files.reduce((size,file)=>size+file.code.length,0)<=48000);
  assert.ok(context.files.every(file=>file.end<=160));
  assert.equal(context.files.some(file=>file.path==="00-too-large.ts"),false);
  await writeFile(join(directory,"attachments.json"),"{broken");
  const state=await courseCommand(data,"status",{courseId});
  assert.equal(state.attachment.available,false);
  assert.equal(state.course.lessons.length,18);
  assert.match(await readFile(join(directory,"attachments.json"),"utf8"),/broken/);
});
