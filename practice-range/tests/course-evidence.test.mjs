import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { moduleEvidence, dueDrills } from "../mods/practice-range/courses/evidence.js";
import { nextCourseAction } from "../mods/practice-range/courses/review.js";
import { courseCommand } from "../mods/practice-range/courses/service.mjs";

const day = 86400000;
const pack = { modules: [{ id: "a" }, { id: "b" }], lessons: [
  { id: "a", steps: [{}, {}], tasks: [{ id: "a0", concepts: ["x"] }, { id: "a1", concepts: ["x"] }], drills: ["values/one", "values/two"] },
  { id: "b", steps: [{}], tasks: [{ id: "b0", concepts: ["y"] }], drills: ["lists/one"] },
] };
const attempt = (passed, assisted) => ({ at: 0, passed, assisted });
const task = (history, extra = {}) => ({ attempts: history.length, passes: history.filter(a => a.passed).length,
  independentPasses: history.filter(a => a.passed && !a.assisted).length, hintCount: 0, history, ...extra });
const none = { progress: {}, currentTopic: null };
const status = (state, drills = none) => Object.fromEntries(Object.entries(moduleEvidence(pack, { modules: {}, ...state }, drills)).map(([id, e]) => [id, e.status]));

test("reading, skipping, hinted passes and revealed solutions never count as independent skill", () => {
  assert.deepEqual(status({ tasks: {} }), { a: "new", b: "new" });
  assert.deepEqual(status({ tasks: {}, modules: { a: { seen: [0] }, b: { seen: [0] } } }), { a: "started", b: "read" });
  assert.deepEqual(status({ tasks: {}, modules: { a: { seen: [0, 1], skipped: true } } }).a, "skipped");
  // A hinted pass and a pass after the solution was shown are both recorded as assisted.
  assert.equal(status({ tasks: { a0: task([attempt(true, true)]), a1: task([attempt(false, false), attempt(true, true)], { answerShown: true }) } }).a, "practiced");
  // Imported answers carry unknown assistance, which the checker records as assisted.
  assert.equal(status({ tasks: { a0: task([{ ...attempt(true, true), assistanceUnknown: true }], { assistanceUnknown: true }) } }).a, "practiced");
});

test("independent passes on two exercises, or one confirmed by a later clean review, demonstrate a module", () => {
  assert.equal(status({ tasks: { a0: task([attempt(true, false)]) } }).a, "independent-once");
  assert.equal(status({ tasks: { a0: task([attempt(true, false)]), a1: task([attempt(true, true), attempt(true, false)]) } }).a, "demonstrated",
    "A later independent pass counts even after an earlier assisted one");
  assert.equal(status({ tasks: { a0: task([attempt(true, true), { ...attempt(true, false), review: true }], { review: { streak: 1, at: 0 } }) } }).a, "demonstrated",
    "A clean review after help counts as later independent evidence");
  assert.equal(status({ tasks: { a0: task([attempt(true, false)], { review: { streak: 0, at: 0 } }) } }).a, "independent-once", "A failed review confirms nothing");
  assert.equal(status({ tasks: { a0: task([attempt(true, false)]), a1: task([attempt(true, false)]) }, modules: { a: { skipped: true } } }).a, "demonstrated",
    "Evidence outranks a skip");
});

test("linked drill evidence combines with course exercises in mixed sessions", () => {
  const drills = { currentTopic: null, progress: {
    "values/one": { attempts: 1, passes: 1, independentPasses: 1, last: 0 },
    "values/two": { attempts: 2, passes: 1, independentPasses: 1, hinted: true, last: 0 },
    "lists/one": { attempts: 1, passes: 1, independentPasses: 0, last: 0 } } };
  const result = moduleEvidence(pack, { modules: {}, tasks: {} }, drills);
  assert.deepEqual(result.a, { status: "independent-once", independent: 1, practiced: 2, reviewed: false }, "A hinted drill does not count");
  assert.equal(result.b.status, "practiced", "A drill passed only after the answer was shown does not count");
  assert.equal(status({ tasks: { a0: task([attempt(true, false)]) } }, drills).a, "demonstrated");
  assert.equal(status({ tasks: {} }, { ...drills, progress: { ...drills.progress, "values/one": { ...drills.progress["values/one"], review: { streak: 1, at: 0 } } } }).a, "demonstrated");
});

test("overdue linked drills are recommended after course review, excluding the current practice topic", () => {
  const drills = { currentTopic: null, progress: { "values/one": { attempts: 1, passes: 1, independentPasses: 1, last: 0 }, "lists/one": { attempts: 1, passes: 0, independentPasses: 0, last: 0 } } };
  const state = { modules: { a: { seen: [0, 1] }, b: { seen: [0] } }, tasks: {} };
  assert.deepEqual(dueDrills(pack, drills, 2 * day), ["lists/one"], "Unhelped drills rest three days");
  assert.deepEqual(dueDrills(pack, drills, 3 * day), ["lists/one", "values/one"]);
  assert.deepEqual(dueDrills(pack, { ...drills, currentTopic: "lists" }, 3 * day), ["values/one"]);
  const next = nextCourseAction(pack, state, 3 * day, drills);
  assert.equal(next.kind, "practice-review"); assert.equal(next.count, 2); assert.match(next.reason, /2 practice drills/);
  state.tasks.a0 = task([attempt(true, false)]);
  assert.equal(nextCourseAction(pack, state, 4 * day, drills).kind, "review", "Due course exercises come first");
  assert.equal(nextCourseAction(pack, { ...state, tasks: {} }, 0, drills).kind, "practice", "Nothing due, nothing unread");
  assert.equal(nextCourseAction(pack, { ...state, tasks: {} }, 3 * day).kind, "practice", "Without drill data nothing changes");
});

test("a changed course version counts only its own exercises, while drill evidence carries over", () => {
  const changed = { ...pack, lessons: [{ ...pack.lessons[0], tasks: [{ id: "a2", concepts: ["x"] }] }, pack.lessons[1]] };
  const state = { modules: {}, tasks: { a0: task([attempt(true, false)]), a1: task([attempt(true, false)]) } };
  assert.equal(moduleEvidence(pack, state, none).a.status, "demonstrated");
  assert.equal(moduleEvidence(changed, state, none).a.status, "new", "Removed exercises are not inferred as passes in the new version");
  const drills = { currentTopic: null, progress: { "values/one": { attempts: 1, passes: 1, independentPasses: 1, last: 0 } } };
  assert.equal(moduleEvidence(changed, { modules: {}, tasks: {} }, drills).a.status, "independent-once");
});

test("course snapshots read practice progress and survive damaged practice sessions", async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-course-evidence-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const courseId = "course:ts-foundations", moduleId = `${courseId}/module/values`, session = join(root, "languages/typescript/session.json");
  let state = await courseCommand(root, "enroll", { courseId });
  assert.equal(state.evidence[moduleId].status, "new"); assert.equal(state.drillError, null);
  await mkdir(join(session, ".."), { recursive: true });
  await writeFile(session, JSON.stringify({ version: 1, languageId: "typescript", exerciseId: "loops/for-of", progress: {
    "variables/const-number": { attempts: 1, passes: 1, independentPasses: 1, last: 0 },
    "variables/let-reassign": { attempts: 1, passes: 1, independentPasses: 1, last: 0 } } }));
  state = await courseCommand(root, "status", { courseId });
  assert.equal(state.evidence[moduleId].status, "demonstrated");
  assert.deepEqual(state.enrollment.tasks, {}, "Drill evidence never writes course progress");
  assert.equal(state.recommendation.kind, "practice-review", "Due reviews come before unread lessons, as with course review");
  await writeFile(session, "{ damaged");
  state = await courseCommand(root, "status", { courseId });
  assert.equal(state.evidence[moduleId].status, "new"); assert.match(state.drillError, /could not be read/);
});
