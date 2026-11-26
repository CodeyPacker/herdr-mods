import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand, enrollmentDirectory } from "../mods/practice-range/courses/service.mjs";
import { loadCourse } from "../mods/practice-range/courses/loader.mjs";
import { generateRepoLesson } from "../mods/practice-range/courses/supplements.mjs";
import { cancelRequest } from "../mods/practice-range/tutor/service.mjs";

const courseId="course:ts-foundations", moduleId=`${courseId}/module/values`;
const git=(root,...args)=>execFileSync("git",["-C",root,...args],{encoding:"utf8"}).trim();
const document={title:"Values in the sample",sections:[{title:"A numeric value",text:"The exported count starts at one.",references:[{path:"src/δ.ts",start:1,end:1}]}]};
const response=doc=>({code:0,stdout:JSON.stringify({result:JSON.stringify(doc)}),stderr:"",problem:""});
async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),"herdr-repo-lessons-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const folder=join(root,"repo"), data=join(root,"data"), config=join(root,"config.json");
  await mkdir(join(folder,"src"),{recursive:true});
  git(folder,"init","-q");
  await writeFile(join(folder,"src/δ.ts"),"export const count = 1;\n");
  git(folder,"add",".");
  git(folder,"-c","user.name=Fixture","-c","user.email=fixture@example.com","commit","-qm","Sample");
  await writeFile(config,JSON.stringify({tutor:{enabled:true,provider:"claude"}}));
  await courseCommand(data,"enroll",{courseId});
  await courseCommand(data,"attach-repo",{courseId,path:folder});
  const directory=enrollmentDirectory(data,await loadCourse(courseId));
  return {root,folder,data,config,directory,request:{id:"repo-lesson",courseId,moduleId}};
}

test("repo lessons keep verified pinned excerpts, preserve progress, and survive a missing repo",async t=>{
  const f=await fixture(t);
  await writeFile(join(f.folder,"src/δ.ts"),"export const count = 99;\n");
  const dirty=git(f.folder,"status","--porcelain"), before=(await courseCommand(f.data,"status",{courseId})).enrollment;
  let calls=0;
  const options={run:async (_provider,args,options)=>{
    calls++;
    assert.match(args[args.indexOf("--system-prompt")+1],/Return one JSON object/);
    assert.equal(args[args.indexOf("--tools")+1],"");
    const context=JSON.parse(options.input);
    assert.equal(context.target,moduleId);
    assert.match(context.repository.files[0].code,/count = 1/);
    assert.equal(context.lesson.steps.some(step=>"solution" in step),false);
    assert.equal(options.input.includes(f.root),false,"No absolute repo path enters the model prompt");
    return response({...document,unexpected:"ignored",sections:[{...document.sections[0],references:[{path:"src/δ.ts",start:1,end:1,code:"invented code"}]}]});
  }};
  let state=await generateRepoLesson(f.data,f.config,f.request,options);
  const lesson=state.repoLessons.lessons[0];
  assert.equal(lesson.sections[0].references[0].code,"export const count = 1;");
  assert.equal(lesson.unexpected,undefined);
  assert.deepEqual(state.enrollment,before);
  assert.equal(git(f.folder,"status","--porcelain"),dirty);
  const saved=await readFile(join(f.directory,"repo-lessons.json"),"utf8");
  await generateRepoLesson(f.data,f.config,f.request,options);
  assert.equal(calls,1,"Existing lessons are reused rather than overwritten");
  assert.equal(await readFile(join(f.directory,"repo-lessons.json"),"utf8"),saved);
  await generateRepoLesson(f.data,f.config,{...f.request,moduleId:undefined,id:"architecture"},{run:async (_provider,_args,options)=>{
    assert.equal(JSON.parse(options.input).target,"architecture");
    return response({...document,title:"Sample architecture"});
  }});
  await rename(f.folder,join(f.root,"moved"));
  state=await courseCommand(f.data,"status",{courseId});
  assert.equal(state.attachment.available,false);
  assert.equal(state.repoLessons.lessons.length,2);
  await courseCommand(f.data,"detach-repo",{courseId});
  assert.equal((await courseCommand(f.data,"status",{courseId})).repoLessons.lessons.length,2);
});

test("invalid model references and malformed responses never create saved lessons",async t=>{
  const f=await fixture(t);
  for(const ref of [null,{path:"../secret",start:1,end:1},{path:"src/δ.ts",start:0,end:1},{path:"src/δ.ts",start:1,end:200},{path:"src/δ.ts",start:1.5,end:2}]) {
    const invalid={...document,sections:[{...document.sections[0],references:[ref]}]};
    await assert.rejects(generateRepoLesson(f.data,f.config,f.request,{run:async()=>response(invalid)}),/invalid text or source references/);
  }
  await assert.rejects(generateRepoLesson(f.data,f.config,f.request,{run:async()=>({code:0,stdout:JSON.stringify({result:"not JSON"})})}),/readable repo lesson/);
  assert.equal((await courseCommand(f.data,"status",{courseId})).repoLessons.lessons.length,0);
  await assert.rejects(readFile(join(f.directory,"repo-lessons.json")),{code:"ENOENT"});
});

test("cancellation, disabling AI, provider failure, and repo replacement leave no generated content",async t=>{
  const f=await fixture(t);
  await assert.rejects(generateRepoLesson(f.data,f.config,f.request,{run:async()=>{
    await cancelRequest(f.data,f.request.id); return response(document);
  }}),/cancelled/);
  await assert.rejects(generateRepoLesson(f.data,f.config,f.request,{run:async()=>{
    await writeFile(f.config,JSON.stringify({tutor:{enabled:false}})); return response(document);
  }}),/cancelled/);
  await writeFile(f.config,JSON.stringify({tutor:{enabled:true,provider:"claude"}}));
  await assert.rejects(generateRepoLesson(f.data,f.config,f.request,{run:async()=>({code:1,problem:"account unavailable"})}),/account unavailable/);
  await assert.rejects(generateRepoLesson(f.data,f.config,f.request,{run:async()=>{
    await writeFile(join(f.folder,"src/δ.ts"),"export const count = 2;\n");
    git(f.folder,"add",".");
    git(f.folder,"-c","user.name=Fixture","-c","user.email=fixture@example.com","commit","-qm","Change example");
    await courseCommand(f.data,"attach-repo",{courseId,path:f.folder}); return response(document);
  }}),/changed during generation/);
  await assert.rejects(generateRepoLesson(f.data,f.config,f.request,{run:async()=>{
    await courseCommand(f.data,"detach-repo",{courseId}); return response(document);
  }}),/Attach an available repo/);
  assert.equal((await courseCommand(f.data,"status",{courseId})).repoLessons.lessons.length,0);
});

test("damaged supplemental data leaves the course usable and is not overwritten",async t=>{
  const f=await fixture(t), path=join(f.directory,"repo-lessons.json");
  await writeFile(path,"{broken");
  const state=await courseCommand(f.data,"status",{courseId});
  assert.equal(state.course.lessons.length,18);
  assert.match(state.repoLessons.error,/could not be read/);
  await assert.rejects(generateRepoLesson(f.data,f.config,f.request,{run:async()=>{throw new Error("Must not call model");}}),/could not be read/);
  assert.equal(await readFile(path,"utf8"),"{broken");
});
