import { test } from "node:test";
import assert from "node:assert/strict";
import { courseReview, nextCourseAction } from "../mods/practice-range/courses/review.js";
const day = 86400000;
const pack = { modules: [{id:"a"},{id:"b"}], lessons: [
  { id:"a", steps:[{},{}], tasks: Array.from({length:5},(_,i)=>({id:`a${i}`,concepts:["types"]})) },
  { id:"b", steps:[{}], tasks:[{id:"b0",concepts:["functions"]}] },
] };
const progress = (at, assisted = false) => ({ attempts: 1, passes: 1, independentPasses: assisted ? 0 : 1,
  history: [{ at, passed: true, assisted }] });

test("course review reuses practice intervals, prioritizes help, and caps each module", () => {
  const state = { tasks: { a0:progress(0), a1:progress(0,true), a2:progress(0), a3:progress(0), b0:progress(0) } };
  assert.deepEqual(courseReview(pack,state,day).ids,["a1"]);
  const result = courseReview(pack,state,4*day);
  assert.equal(result.ids[0],"a1");
  assert.equal(result.ids.filter(id=>id.startsWith("a")).length,3);
  assert.ok(result.ids.includes("b0"));
  state.tasks.a1.review = {streak:3,at:0};
  assert.equal(courseReview(pack,state,4*day).ids.includes("a1"),false);
});

test("recommendations explain related practice, review, skips and unread work without awarding skill", () => {
  const state = { tasks: {}, modules: {} };
  assert.deepEqual(nextCourseAction(pack,state,0), {kind:"lesson",moduleId:"a",step:0,reason:"Continue with the next unread lesson step."});
  state.tasks.a0 = progress(0,true);
  assert.equal(nextCourseAction(pack,state,0).taskId,"a1");
  state.tasks.a0 = progress(0);
  assert.equal(nextCourseAction(pack,state,4*day).kind,"review");
  state.modules.a = {skipped:true};
  assert.equal(nextCourseAction(pack,state,0).moduleId,"b");
  assert.equal(state.tasks.a0.independentPasses,1,"Recommendations never rewrite evidence");
});
