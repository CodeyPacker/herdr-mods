import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command } from "../mods/syntax/runner.mjs";
import { completeSetup } from "../mods/syntax/setup.mjs";
import { findLanguage } from "../mods/syntax/languages/index.js";
import { catalogFor } from "../mods/syntax/catalog.js";

const typescript = catalogFor(findLanguage("typescript"));
const csharp = catalogFor(findLanguage("csharp"));
// Setup checks the editor command. These tests stub it so they never depend on a local editor.
const installed = { run: async () => ({ code: 0, stdout: "test", stderr: "", problem: "" }) };

async function practiceRoot(t, name, languages) {
  const root = await mkdtemp(join(tmpdir(), `syntax-ts-session-${name}-`));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const id of languages) await completeSetup(root, "neovim", id, installed);
  return root;
}

const saved = state => JSON.stringify({ languageId: state.languageId, exerciseId: state.exerciseId, sourceHash: state.sourceHash });

test("TypeScript practice uses its own directory, prepares the editor, and checks saved answers", { timeout: 120000 }, async t => {
  const root = await practiceRoot(t, "flow", ["typescript"]);
  let state = await command(root, "status");
  assert.equal(state.languageId, "typescript");
  assert.equal(state.exerciseId, "variables/const-number");
  assert.equal(state.root, join(root, "languages", "typescript"));
  assert.equal(state.file, join(root, "languages", "typescript", "answers", "variables", "const-number", "Exercise.ts"));
  assert.equal(state.runtimeVersion, "TypeScript 6.0.3");
  assert.equal(await readFile(state.file, "utf8"), "// Write your answer here.\n");
  const config = JSON.parse(await readFile(join(state.folder, "tsconfig.json"), "utf8"));
  assert.equal(config.compilerOptions.strict, true);
  assert.match(await readFile(join(state.folder, "globals.d.ts"), "utf8"), /declare var console/);
  const configTime = (await stat(join(state.folder, "tsconfig.json"))).mtimeMs;
  await command(root, "hint");
  assert.equal((await stat(join(state.folder, "tsconfig.json"))).mtimeMs, configTime, "Unchanged editor files are not rewritten");

  state = await command(root, "check-saved", saved(state));
  assert.equal(state.result, null, "The generated starter is not a save attempt");
  await writeFile(state.file, "const count = 12;\n");
  state = await command(root, "check-saved", saved(state));
  assert.equal(state.result.passed, true);
  assert.equal(state.progress["variables/const-number"].attempts, 1);
  state = await command(root, "check-saved", saved(state));
  assert.equal(state.progress["variables/const-number"].attempts, 1, "Duplicate save events do not count twice");
  await writeFile(state.file, "const count = 12;\nconst label: number = \"x\";\n");
  state = await command(root, "check");
  assert.equal(state.result.kind, "compile");
  assert.match(state.result.details[0], /^Exercise\.ts:2:/);

  state = await command(root, "select", "narrowing/in-narrowing");
  assert.match(await readFile(join(state.folder, "supplied.ts"), "utf8"), /type Fish/);
  assert.match(await readFile(join(state.folder, "README.md"), "utf8"), /```typescript\ntype Fish/);
  state = await command(root, "select", "modules/import-named");
  assert.match(await readFile(join(state.folder, "math.ts"), "utf8"), /export function add/);
  await writeFile(state.file, "import { add } from \"./math.js\";\nexport const total = add(2, 3);\n");
  assert.equal((await command(root, "check")).result.passed, true);

  state = await command(root, "repeat");
  assert.equal(await readFile(state.file, "utf8"), "// Write your answer here.\n");
  assert.equal((await readdir(join(root, "languages", "typescript", "history", "modules", "import-named"))).length, 1);
  assert.deepEqual(await readdir(join(root, "languages", "typescript", "checks")), [], "Temporary check files are removed");
});

test("switching languages keeps separate answers, progress, and selections for matching exercise IDs", { timeout: 180000 }, async t => {
  const root = await practiceRoot(t, "switch", ["csharp", "typescript"]);
  const shared = "operators/add";
  assert.ok(typescript.exercises.some(item => item.id === shared) && csharp.exercises.some(item => item.id === shared));

  let ts = await command(root, "select", shared);
  assert.equal(ts.languageId, "typescript");
  await writeFile(ts.file, typescript.findExercise(shared).solution + "\n");
  ts = await command(root, "check");
  assert.equal(ts.result.passed, true);

  let cs = await command(root, "language", "csharp");
  assert.equal(cs.languageId, "csharp");
  assert.equal(cs.root, root, "C# keeps the original practice paths");
  cs = await command(root, "select", shared);
  assert.notEqual(cs.file, ts.file);
  assert.equal(await readFile(cs.file, "utf8"), "        // Write your answer here.\n".trimStart());
  assert.equal(cs.progress[shared], undefined, "TypeScript progress does not appear in C#");
  const pendingCsharp = saved(cs);

  ts = await command(root, "language", "typescript");
  assert.equal(ts.exerciseId, shared, "Each language keeps its selected exercise");
  assert.equal(ts.progress[shared].passes, 1);
  assert.equal(await readFile(ts.file, "utf8"), typescript.findExercise(shared).solution + "\n", "Switching never rewrites the other answer");

  // A save notification from before the switch must not check or count against TypeScript.
  ts = await command(root, "check-saved", pendingCsharp);
  assert.equal(ts.progress[shared].attempts, 1);
  ts = await command(root, "check-saved", JSON.stringify({ exerciseId: shared, sourceHash: "older-tab" }));
  assert.equal(ts.progress[shared].attempts, 1, "Notifications without a language belong to C#");

  const csharpSession = JSON.parse(await readFile(join(root, "session.json"), "utf8"));
  assert.equal(csharpSession.languageId, "csharp");
  assert.equal(csharpSession.exerciseId, shared);
  const typescriptSession = JSON.parse(await readFile(join(root, "languages", "typescript", "session.json"), "utf8"));
  assert.equal(typescriptSession.languageId, "typescript");
  await assert.rejects(command(root, "language", "python"), /Language pack is not installed/);
});

test("an older C# session without languageId is untouched by TypeScript and reopens as C#", { timeout: 120000 }, async t => {
  const root = await practiceRoot(t, "legacy", ["csharp", "typescript"]);
  const legacy = JSON.stringify({ version: 1, exerciseId: "loops/for", hintCount: 1, answerShown: false, progress: { "loops/for": { attempts: 2, passes: 1, independentPasses: 1 } }, result: null });
  await writeFile(join(root, "session.json"), legacy);
  await command(root, "hint");
  assert.equal(await readFile(join(root, "session.json"), "utf8"), legacy, "TypeScript actions never write the C# session");
  const reopened = await command(root, "language", "csharp");
  assert.equal(reopened.languageId, "csharp");
  assert.equal(reopened.exerciseId, "loops/for");
  assert.equal(reopened.hintCount, 1);
  assert.deepEqual(reopened.progress["loops/for"], { attempts: 2, passes: 1, independentPasses: 1 });
});

test("a language must finish setup before practice can switch to it", { timeout: 60000 }, async t => {
  const root = await practiceRoot(t, "gate", ["csharp"]);
  await assert.rejects(command(root, "language", "typescript"), /Set up TypeScript/);
  assert.equal((await command(root, "setup-status")).languageId, "csharp");
});
