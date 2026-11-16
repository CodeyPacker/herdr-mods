import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import typescript from "../mods/syntax/languages/typescript/index.js";
import { catalogFor } from "../mods/syntax/catalog.js";
import { checkAnswer } from "../mods/syntax/languages/typescript/runner.mjs";
import { loadTypeScript, unknownRuleKinds } from "../mods/syntax/languages/typescript/compiler.mjs";
import { checkingFiles, exerciseSource } from "../mods/syntax/languages/typescript/source.mjs";

const { topics, exercises, findExercise } = catalogFor(typescript);

async function scratch(t, name) {
  const root = await mkdtemp(join(tmpdir(), `syntax-ts-${name}-`));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("the TypeScript catalog has 20 topics of 40 distinct, well-formed exercises", async () => {
  const ts = await loadTypeScript();
  assert.equal(topics.length, 20);
  assert.equal(exercises.length, 800);
  assert.equal(new Set(exercises.map(item => item.id)).size, 800);
  assert.equal(topics.filter(topic => topic.level === "advanced").length, 6);
  for (const topic of topics) {
    assert.equal(topic.exercises.length, 40, topic.id);
    assert.equal(new Set(topic.exercises.map(item => item.solution)).size, 40, `${topic.id}: solutions repeat`);
    assert.equal(new Set(topic.exercises.map(item => item.prompt)).size, 40, `${topic.id}: prompts repeat`);
  }
  for (const exercise of exercises) {
    assert.equal(exercise.hints.length, 3, exercise.id);
    assert.ok(exercise.hints[2].includes("___"), `${exercise.id}: the final hint stays a skeleton`);
    assert.ok(!exercise.hints.some(hint => hint.includes(exercise.solution)), `${exercise.id}: hints must not reveal the answer`);
    assert.ok(exercise.rules.length > 0, exercise.id);
    assert.ok((exercise.checks?.length ?? 0) + (exercise.typeChecks?.length ?? 0) + (exercise.rejects?.length ?? 0) > 0, exercise.id);
    assert.deepEqual(unknownRuleKinds(ts, exercise.rules), [], exercise.id);
    assert.equal(exerciseSource(exercise, exercise.solution), `${exercise.solution}\n`);
    if (exercise.mode === "module") assert.equal(exercise.declarations, undefined, `${exercise.id}: module exercises use fixture files`);
  }
});

test("generated checks keep the answer on its own lines for source mapping", () => {
  for (const exercise of [findExercise("variables/const-number"), findExercise("narrowing/in-narrowing"), findExercise("modules/import-named")]) {
    const { files, segments } = checkingFiles(exercise, exercise.solution);
    const lines = files["check.ts"].split("\n");
    const answer = segments.find(segment => segment.kind === "answer");
    if (exercise.mode === "module") {
      assert.equal(answer, undefined);
      assert.equal(files["Exercise.ts"], exercise.solution);
    } else assert.equal(lines.slice(answer.start, answer.end).join("\n"), exercise.solution);
  }
});

test("all 800 reference answers type-check, use the requested syntax, and pass their checks, while empty starters fail", { timeout: 900000 }, async t => {
  const root = await scratch(t, "catalog");
  const failures = [];
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < exercises.length) {
      const exercise = exercises[next++];
      const result = await checkAnswer(root, exercise, exercise.solution);
      if (!result.passed) failures.push(`${exercise.id}: ${JSON.stringify(result)}`);
      const empty = await checkAnswer(root, exercise, exercise.starter);
      if (empty.passed) failures.push(`${exercise.id}: the empty starter passes`);
    }
  }));
  assert.deepEqual(failures, []);
  assert.deepEqual(await readdir(join(root, "checks")), [], "Check artifacts are removed");
});

test("syntax requirements ignore comments and strings and accept equivalent forms", { timeout: 60000 }, async t => {
  const root = await scratch(t, "syntax");
  const constant = findExercise("variables/const-number");
  assert.equal((await checkAnswer(root, constant, "let count = 12;")).kind, "syntax");
  assert.equal((await checkAnswer(root, constant, "// const count = 12;\nconst total = 12;")).kind, "syntax");
  assert.equal((await checkAnswer(root, constant, "const text = \"const count = 12;\";")).kind, "syntax");
  assert.equal((await checkAnswer(root, constant, "/* const count = 12 */ const text = `const count = 12`;")).kind, "syntax");
  assert.equal((await checkAnswer(root, constant, "const count: 12 = 12;")).passed, true);
  const loop = findExercise("loops/for-sum");
  assert.equal((await checkAnswer(root, loop, "function sumTo(limit: number): number {\n  let total = 0;\n  for (let i = limit; i > 0; i -= 1) total += i;\n  return total;\n}")).passed, true);
  assert.equal((await checkAnswer(root, loop, "function sumTo(limit: number): number {\n  return (limit * (limit + 1)) / 2;\n}")).kind, "syntax");
  assert.equal((await checkAnswer(root, findExercise("operators/decrement"), "let lives = 3;\n--lives;")).passed, true);
  const suppressed = await checkAnswer(root, constant, "// @ts-ignore\nconst count = 12;");
  assert.equal(suppressed.kind, "syntax");
  assert.match(suppressed.details[0], /@ts-ignore/);
});

test("type errors, wrong results, and hardcoded answers are reported separately", { timeout: 60000 }, async t => {
  const root = await scratch(t, "feedback");
  const add = findExercise("functions/declaration");
  const wrongType = await checkAnswer(root, add, "function add(a: number, b: number): string {\n  return String(a + b);\n}");
  assert.equal(wrongType.kind, "types");
  assert.ok(wrongType.details.some(detail => detail.includes("Type check 1")), JSON.stringify(wrongType));
  const wrongResult = await checkAnswer(root, add, "function add(a: number, b: number): number {\n  return a - b;\n}");
  assert.equal(wrongResult.kind, "result");
  assert.match(wrongResult.details[0], /^Check 1 failed: add\(2, 3\) === 5$/);
  const hardcoded = await checkAnswer(root, findExercise("strings/upper"), "function shout(text: string): string {\n  text.toUpperCase();\n  return \"HI\";\n}");
  assert.equal(hardcoded.kind, "result", "A hardcoded value fails checks with other inputs");
  const level = await checkAnswer(root, findExercise("primitives/numeric-literal-union"), "let level: 1 | 2 | 3 | 4 = 1;");
  assert.equal(level.kind, "types");
  assert.ok(level.details.some(detail => detail.includes("should be a type error")), JSON.stringify(level));
  const mapped = await checkAnswer(root, findExercise("mappedTypes/flags"), "type Flags<T> = { [K in keyof T]: string };");
  assert.equal(mapped.kind, "types");
});

test("compiler and runtime errors point at the learner's own lines", { timeout: 60000 }, async t => {
  const root = await scratch(t, "mapping");
  const constant = findExercise("variables/const-number");
  const parse = await checkAnswer(root, constant, "const count = 12;\nconst broken = ;");
  assert.equal(parse.kind, "compile");
  assert.match(parse.details[0], /^Exercise\.ts:2:16 - error TS1109/);
  const typed = await checkAnswer(root, constant, "const count = 12;\nconst label: number = \"x\";");
  assert.equal(typed.kind, "compile");
  assert.match(typed.details[0], /^Exercise\.ts:2:7 - error TS2322/);
  const thrown = await checkAnswer(root, constant, "const count = 12;\nconst value = (null as unknown as { a: number }).a;");
  assert.equal(thrown.kind, "result");
  assert.match(thrown.details[0], /TypeError/);
  assert.equal(thrown.details[1], "at Exercise.ts:2:50");
  const moduleError = await checkAnswer(root, findExercise("modules/import-named"), "import { subtract } from \"./math.js\";\nexport const total = subtract(2, 3);");
  assert.equal(moduleError.kind, "compile");
  assert.match(moduleError.details[0], /^Exercise\.ts:1:10 - error TS2305/);
});

test("runaway loops, unsettled promises, and output floods stop with bounded feedback", { timeout: 60000 }, async t => {
  const root = await scratch(t, "runaway");
  const loop = await checkAnswer(root, findExercise("loops/for-sum"), "function sumTo(limit: number): number {\n  let total = 0;\n  for (let i = 1; i <= limit; i--) total += i;\n  return total;\n}", { timeout: 500 });
  assert.equal(loop.kind, "runtime");
  assert.match(loop.details[0], /time limit/);
  const promise = await checkAnswer(root, findExercise("async/async-function"), "async function getCount(): Promise<number> {\n  await new Promise<void>(() => {});\n  return 4;\n}");
  assert.equal(promise.kind, "runtime");
  assert.match(promise.details[0], /never settled/);
  const flood = await checkAnswer(root, findExercise("variables/const-number"), "const count = 12;\nwhile (true) console.log(\"x\".repeat(1000));");
  assert.equal(flood.kind, "runtime");
  assert.match(flood.details[0], /too much output/);
  assert.deepEqual(await readdir(join(root, "checks")), []);
});
