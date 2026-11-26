import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { courseCommand, enrollmentDirectory, coursePack } from "../mods/practice-range/courses/service.mjs";
import { loadCourse } from "../mods/practice-range/courses/loader.mjs";
import { generateExtraPractice, extraContext } from "../mods/practice-range/courses/extras.mjs";
import { cancelRequest } from "../mods/practice-range/tutor/service.mjs";

const courseId = "course:ts-foundations", moduleId = `${courseId}/module/values`;
const exercise = (title, a, b) => ({ title, prompt: `Print the sum of ${a} and ${b}.`, concept: "Values", starter: "// Print the sum\n",
  solution: `const total = ${a} + ${b};\nconsole.log(total);\n`, expected: String(a + b), hints: ["Store the sum in a const.", "Use console.log."],
  wrong: [{ code: `console.log(${a} - ${b});\n`, why: "Subtracts instead of adding." }] });
const response = doc => ({ code: 0, stdout: JSON.stringify({ result: JSON.stringify(doc) }) });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "practice-course-extras-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = join(root, "config.json");
  await writeFile(config, JSON.stringify({ tutor: { enabled: true, provider: "claude" } }));
  await courseCommand(root, "enroll", { courseId });
  const directory = enrollmentDirectory(root, await loadCourse(courseId));
  return { root, config, directory, request: { id: "extra", courseId, moduleId } };
}

test("validated extra practice is saved beside a bundled enrollment and stays out of evidence and review", { timeout: 180000 }, async t => {
  const f = await fixture(t), shipped = JSON.stringify(await loadCourse(courseId));
  let captured;
  await generateExtraPractice(f.root, f.config, f.request, { run: async (_provider, args, options) => {
    captured = JSON.parse(options.input);
    assert.match(args[args.indexOf("--system-prompt") + 1], /existingTasks/);
    return response({ exercises: [exercise("Add arrivals", 3, 4)] });
  } });
  assert.ok(captured.existingTasks.length >= 5, "Shipped task titles are sent so extras are variations");
  assert.equal(JSON.stringify(await loadCourse(courseId)), shipped, "The bundled pack is unchanged");
  let state = await courseCommand(f.root, "status", { courseId });
  const lesson = state.course.lessons.find(lesson => lesson.id === moduleId), extra = lesson.extraTasks[0];
  assert.equal(lesson.extraTasks.length, 1); assert.equal(extra.generated, true);
  assert.equal(lesson.tasks.some(task => task.id === extra.id), false);
  assert.equal(JSON.stringify(state.course).includes("Subtracts"), false, "Known wrong answers stay out of the panel snapshot");
  state = await courseCommand(f.root, "task", { courseId, taskId: extra.id });
  await writeFile(state.file, "const total = 3 + 4;\nconsole.log(total);\n");
  state = await courseCommand(f.root, "check", { courseId, taskId: extra.id });
  assert.equal(state.enrollment.tasks[extra.id].independentPasses, 1);
  assert.equal(state.evidence[moduleId].independent, 0, "Extra practice never counts as module evidence");
  state = await courseCommand(f.root, "status", { courseId }, {});
  assert.equal(state.reviewReady, 0);
  // A second request continues numbering and sees the first extra as existing work.
  await generateExtraPractice(f.root, f.config, { ...f.request, id: "extra-2" }, { run: async (_p, _a, options) => {
    assert.ok(JSON.parse(options.input).existingTasks.includes("Add arrivals"));
    return response({ exercises: [exercise("Add departures", 5, 6), exercise("Add seats", 2, 9)] });
  } });
  const saved = JSON.parse(await readFile(join(f.directory, "extra-practice.json"), "utf8")).lessons[moduleId];
  assert.deepEqual(saved.map(task => task.title), ["Add arrivals", "Add departures", "Add seats"]);
  assert.equal(new Set(saved.map(task => task.id)).size, 3);
  assert.equal(saved.every(task => !task.legacy), true, "Bundled TypeScript extras keep the course's compiler settings");
});

test("failed validation, unvalidated saves and cancellation write no extra practice", { timeout: 180000 }, async t => {
  const f = await fixture(t), file = join(f.directory, "extra-practice.json");
  for (const [doc, pattern] of [[{ exercises: [{ ...exercise("Bad", 3, 4), expected: "8" }] }, /reference answer did not pass/],
    [{ exercises: [{ ...exercise("Bad", 3, 4), wrong: [{ code: "console.log(7);\n", why: "Same." }] }] }, /wrong answer passed/],
    [{ status: "unsuitable", reason: "Nothing to print." }, /Nothing to print/]]) {
    await assert.rejects(generateExtraPractice(f.root, f.config, f.request, { run: async () => response(doc) }), pattern);
    await assert.rejects(readFile(file), { code: "ENOENT" });
  }
  await assert.rejects(generateExtraPractice(f.root, f.config, f.request, { run: async () => response({ exercises: [exercise("Add", 3, 4)] }),
    check: async () => { await cancelRequest(f.root, f.request.id); return { passed: true, kind: "passed", title: "", details: [], fixtures: [] }; } }), /cancelled/);
  const context = await extraContext(f.root, await coursePack(f.root, courseId), f.request);
  const request = { ...f.request, contextHash: createHash("sha256").update(JSON.stringify(context)).digest("hex"), document: { exercises: [exercise("Add", 3, 4)] } };
  await assert.rejects(courseCommand(f.root, "save-extras", request), /must pass validation/);
  await assert.rejects(readFile(file), { code: "ENOENT" });
  assert.deepEqual((await readdir(join(f.root, ".course-authoring"))), []);
});

test("damaged extra practice is hidden without losing course progress or its own answers", { timeout: 180000 }, async t => {
  const f = await fixture(t), file = join(f.directory, "extra-practice.json");
  await generateExtraPractice(f.root, f.config, f.request, { run: async () => response({ exercises: [exercise("Add arrivals", 3, 4)] }) });
  const extraId = (await courseCommand(f.root, "status", { courseId })).course.lessons.find(lesson => lesson.id === moduleId).extraTasks[0].id;
  await courseCommand(f.root, "task", { courseId, taskId: extraId });
  const original = await readFile(file, "utf8");
  await writeFile(file, original.replace('"role": "generated"', '"role": "core"'));
  let state = await courseCommand(f.root, "status", { courseId });
  assert.match(state.extrasError, /could not be read/); assert.equal(state.enrollment.activeTask, null);
  state = await courseCommand(f.root, "open", { courseId, moduleId, step: 0 });
  assert.ok(state.enrollment.tasks[extraId], "Progress on hidden extra practice is preserved");
  await assert.rejects(generateExtraPractice(f.root, f.config, f.request, { run: async () => response({ exercises: [exercise("Add", 1, 2)] }) }), /could not be read/);
  await writeFile(file, original);
  state = await courseCommand(f.root, "task", { courseId, taskId: extraId });
  assert.equal(state.extrasError, null); assert.equal(state.enrollment.activeTask, extraId);
});
