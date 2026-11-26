// Authoring-only validation. Run with node verify.mjs from any directory.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAnswer, environment } from "../../mods/practice-range/languages/typescript/runner.mjs";
import { exercises as drills } from "../../mods/practice-range/languages/typescript/catalog.js";

const root = dirname(fileURLToPath(import.meta.url));
const tmp = await mkdtemp(join(tmpdir(), "practice-range-course-"));
const compiler = await environment();
const ids = new Set();
const drillIds = new Set(drills.map(drill => drill.id));
const counts = { examples: 0, diagnostics: 0, references: 0, alternatives: 0, starters: 0, wrongWitnesses: 0, wrongCaseRuns: 0 };
const source = async (dir, rel) => {
  const path = resolve(dir, rel);
  assert.ok(path.startsWith(root + sep), "Source outside draft: " + rel);
  return readFile(path, "utf8");
};
const json = async (dir, rel) => JSON.parse(await source(dir, rel));
const unique = id => {
  assert.ok(!ids.has(id), "Duplicate ID " + id);
  ids.add(id);
};
function expectResult(result, passed, label) {
  assert.equal(result.passed, passed, label + " " + JSON.stringify(result));
}
function expectFailure(result, witness) {
  expectResult(result, false, witness.detail);
  assert.equal(result.kind, witness.kind, JSON.stringify(result));
  assert.ok(result.details.some(line => line.includes(witness.detail)), JSON.stringify(result));
}

async function checkExamples(module, dir) {
  for (const [id, example] of Object.entries(module.examples)) {
    const code = await source(dir, example.source.path);
    const result = await checkAnswer(tmp, { rules: [], checks: [] }, code);
    if (example.diagnostics) {
      expectResult(result, false, id);
      assert.equal(result.kind, "compile");
      assert.equal(result.details.length, example.diagnostics.length);
      for (const expected of example.diagnostics) {
        const diagnostic = new RegExp("Exercise\\.ts:" + expected.line + ":\\d+ - error TS" + expected.code + ":");
        assert.ok(result.details.some(line => diagnostic.test(line)), JSON.stringify(result));
      }
      counts.diagnostics++;
    } else {
      expectResult(result, true, id);
      assert.deepEqual(result.details, ["Your code printed:\n" + example.stdout.join("\n")]);
      counts.examples++;
    }
  }
}

async function checkTask(dir, entry, concepts) {
  const spec = await json(dir, entry.path);
  const taskDir = dirname(join(dir, entry.path));
  assert.equal(spec.id, entry.id);
  unique(spec.id);
  assert.ok(spec.concepts.every(c => concepts.has(c)), spec.id);
  assert.equal(spec.hints.length, 3);
  assert.ok(spec.wrongAnswers.length >= 2);
  assert.ok(spec.fixtures.length >= 1);
  const [starter, solution, alternative] = await Promise.all(
    [spec.starter, spec.solution, spec.alternative].map(file => source(taskDir, file))
  );
  const witnessed = new Set();
  let failedStarter = false;
  const modules = {};
  for (const [name, path] of Object.entries(spec.moduleSources ?? {})) modules[name] = await source(taskDir, path);
  for (const fixture of spec.fixtures) {
    const exercise = {
      id: spec.id, mode: spec.mode, rules: spec.rules, checks: spec.checks,
      typeChecks: spec.typeChecks, rejects: spec.rejects,
      declarations: await source(taskDir, fixture.declarations), modules
    };
    const check = answer => checkAnswer(tmp, exercise, answer);
    expectResult(await check(solution), true, spec.id + " solution " + fixture.id);
    counts.references++;
    expectResult(await check(alternative), true, spec.id + " alternative " + fixture.id);
    counts.alternatives++;
    const first = await check(starter);
    if (!first.passed) failedStarter = true;
    counts.starters++;
    for (const wrong of spec.wrongAnswers) {
      const result = await check(await source(taskDir, wrong.source));
      counts.wrongCaseRuns++;
      if (wrong.witness.fixture === fixture.id) {
        expectFailure(result, wrong.witness);
        witnessed.add(wrong.source);
        counts.wrongWitnesses++;
      }
    }
  }
  assert.ok(failedStarter, "Starter passed every case: " + spec.id);
  assert.equal(witnessed.size, spec.wrongAnswers.length);
  console.log(spec.id + " · " + spec.fixtures.length + " fixture(s) · reference and alternative pass · starter fails suite · " + witnessed.size + " wrong-answer witnesses confirmed");
}

async function checkModule(entry, manifest) {
  const dir = dirname(join(root, entry.source.path));
  const module = await json(root, entry.source.path);
  assert.equal(module.id, entry.id);
  const earlier = new Set();
  const collect = id => {
    const prior = manifest.modules.find(m => m.id === id);
    prior.teaches.forEach(c => earlier.add(c));
    prior.prerequisites.forEach(collect);
  };
  entry.prerequisites.forEach(collect);
  module.requires.forEach(c => assert.ok(earlier.has(c), entry.id + " missing prerequisite " + c));
  module.drills.forEach(id => assert.ok(drillIds.has(id), "Unknown drill " + id));
  const questions = new Set(module.questions.map(q => q.id));
  const tasks = new Set(module.tasks.map(t => t.id));
  assert.equal(questions.size, module.questions.length);
  assert.equal(tasks.size, module.tasks.length);
  if (module.review.afterCompletion) assert.equal(entry.id, manifest.modules.at(-1).id);
  else assert.ok(manifest.modules.findIndex(m => m.id === module.review.afterModule) > manifest.modules.indexOf(entry));
  assert.ok(tasks.has(module.review.task));
  for (const q of module.questions) {
    assert.ok(module.examples[q.example]);
    assert.ok(q.choices[q.answer]?.feedback);
    assert.ok(q.choices.every(c => c.text && c.feedback));
    assert.equal(new Set(q.choices.map(c => c.text)).size, q.choices.length);
  }
  for (const step of module.steps) {
    for (const key of [...(step.examples ?? []), ...(step.example ? [step.example] : [])]) assert.ok(module.examples[key]);
    for (const id of step.questions ?? []) assert.ok(questions.has(id));
    for (const id of [...(step.tasks ?? []), ...(step.task ? [step.task] : [])]) assert.ok(tasks.has(id));
  }
  for (const outcome of module.outcomes) {
    assert.ok(outcome.assessment.length);
    outcome.assessment.forEach(id => assert.ok(questions.has(id) || tasks.has(id)));
  }
  await checkExamples(module, dir);
  for (const t of module.tasks) await checkTask(dir, t, new Set([...earlier, ...entry.teaches]));
}

async function checkProject(manifest) {
  const project = await json(root, manifest.project);
  const dir = dirname(join(root, manifest.project));
  for (const p of project.checkpoints) {
    unique(p.id);
    assert.ok(ids.has(p.module));
    if (!p.workspace) continue;
    const names = [...p.workspace.editable, ...p.workspace.supplied];
    assert.equal(new Set(names.map(f => f.file)).size, names.length);
    for (const f of names) await source(dir, f.source);
    for (const f of p.workspace.trusted) await source(dir, f);
    if (p.verification.kind === "boundedProject") {
      // The single-answer checker can import a fixed snapshot of local files.
      // These fixture runs do not exercise editing or saving two learner files.
      const modules = {};
      for (const f of names) modules[f.file] = await source(dir, f.source);
      const answer = [
        'export { audit } from "./audit.js";',
        'export { testAudit } from "./audit.test.js";',
        'export { localBatch, unavailable } from "./sources.js";',
      ].join("\n");
      const check = checks => checkAnswer(tmp, { mode: "module", modules, checks, rules: [] }, answer);
      expectResult(await check([
        '__same(await answer.localBatch({ id: "A" })(), { id: "A" })',
        'await __rejects(answer.unavailable()())',
        'await answer.testAudit(answer.audit) === false',
      ]), true, "Final project fixture and test starter contract");
      const cases = await json(dir, p.verification.cases);
      let matchingReports = 0;
      for (const fixture of cases) {
        const reader = fixture.source === "reject" ? "answer.unavailable()" : "answer.localBatch(" + JSON.stringify(fixture.value) + ")";
        const expression = "__same(await answer.audit(" + reader + "), " + JSON.stringify(fixture.expected) + ")";
        const result = await check([expression]);
        if (fixture.expected.kind === "unavailable") {
          expectResult(result, true, fixture.label);
          matchingReports++;
        } else {
          expectFailure(result, { kind: "result", detail: "Check 1 failed" });
        }
      }
      const readCount = `await (async () => {
        let calls = 0;
        await answer.audit(async () => { calls++; return []; });
        return calls;
      })() === 1`;
      expectFailure(await check([readCount]), { kind: "result", detail: "Check 1 failed" });
      console.log(p.id + " · supplied local readers and starter contracts compile/run · starter matches " + matchingReports + "/" + cases.length + " reports and fails the read-count check");
      continue;
    }
    assert.equal(p.verification.kind, "singleScript");
    const v = p.verification;
    const exercise = { rules: [], checks: await json(dir, v.checks) };
    const check = async file => checkAnswer(tmp, exercise, await source(dir, file));
    expectResult(await check(v.source), false, "Project starter");
    expectResult(await check(v.solution), true, "Project solution");
    expectResult(await check(v.alternative), true, "Project alternative");
    for (const wrong of v.wrongAnswers) expectFailure(await check(wrong.source), wrong.witness);
    console.log(p.id + " · " + exercise.checks.length + " checks · reference and alternative pass · starter and both wrong answers fail");
  }
}
try {
  const manifest = await json(root, "manifest.json");
  assert.equal(manifest.runner.compiler.range, "=" + compiler.version.split(" ").at(-1));
  console.log(compiler.version, process.version);
  const candidates = new Set(process.argv.slice(2));
  for (const key of candidates) assert.ok(manifest.modules.some(m => m.id === manifest.id + "/module/" + key), "Unknown module " + key);
  for (const entry of manifest.modules) {
    entry.prerequisites.forEach(id => assert.ok(ids.has(id), "Missing or out-of-order prerequisite " + id));
    unique(entry.id);
    const key = entry.id.split("/").at(-1);
    if (candidates.has(key)) {
      entry.source ??= { kind: "bundled", path: "modules/" + key + "/module.json" };
      await checkModule(entry, manifest);
    } else if (!candidates.size && entry.source) await checkModule(entry, manifest);
  }
  manifest.outcomes.forEach(o => assert.ok(ids.has(o.assessment)));
  if (!candidates.size) await checkProject(manifest);
  console.log(JSON.stringify(counts));
} finally {
  await rm(tmp, { recursive: true, force: true });
}
