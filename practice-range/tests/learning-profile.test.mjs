import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";
import { courseTutorContext } from "../mods/practice-range/courses/help.mjs";
import { knownLanguages } from "../mods/practice-range/courses/learning-profile.mjs";

const courseId="course:ts-foundations", moduleId=`${courseId}/module/values`;
async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),"herdr-learning-profile-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  return root;
}

test("known languages work before enrollment and personalize questions without changing course progress",async t=>{
  const root=await fixture(t);
  assert.deepEqual((await courseCommand(root,"list")).profile,{configured:false,knownLanguages:[]});
  await courseCommand(root,"profile-save",{knownLanguages:[" Python ","JavaScript","python"]});
  assert.deepEqual((await courseCommand(root,"list")).profile.knownLanguages,["Python","JavaScript"]);
  await courseCommand(root,"enroll",{courseId});
  const before=await courseCommand(root,"open",{courseId,moduleId,step:0});
  let context=await courseTutorContext(root,{courseId,moduleId,step:0,question:"Explain this value."});
  assert.deepEqual(context.knownLanguages,["Python","JavaScript"]);
  await courseCommand(root,"profile-save",{knownLanguages:[]});
  context=await courseTutorContext(root,{courseId,moduleId,step:0,question:"Explain this value."});
  assert.deepEqual(context.knownLanguages,[]);
  const after=await courseCommand(root,"status",{courseId});
  assert.deepEqual(after.enrollment,before.enrollment);
  assert.deepEqual(after.profile,{configured:true,knownLanguages:[]});
});

test("invalid preferences preserve the saved profile and damaged profiles do not block courses",async t=>{
  const root=await fixture(t), file=join(root,"learning.json");
  await courseCommand(root,"profile-save",{knownLanguages:["C++","F#","PL/SQL"]});
  const original=await readFile(file,"utf8");
  for(const input of [null,"Python",[null],[""],["x".repeat(41)],["<instructions>"],Array(9).fill("Java")]) {
    await assert.rejects(courseCommand(root,"profile-save",{knownLanguages:input}),/up to eight language names/);
    assert.equal(await readFile(file,"utf8"),original);
  }
  await writeFile(file,"{broken");
  const catalog=await courseCommand(root,"list");
  assert.match(catalog.profile.error,/could not be read/);
  assert.equal(catalog.courses[0].id,courseId);
  await courseCommand(root,"enroll",{courseId});
  assert.equal((await courseCommand(root,"status",{courseId})).course.lessons.length,18);
  await assert.rejects(courseCommand(root,"profile-save",{knownLanguages:[]}),/could not be read/);
  assert.equal(await readFile(file,"utf8"),"{broken");
  assert.deepEqual(knownLanguages(["C#","c#","日本語"]),["C#","日本語"]);
});
