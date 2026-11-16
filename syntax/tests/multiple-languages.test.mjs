import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { completeSetup, selectLanguage, setupStatus } from "../mods/syntax/setup.mjs";
import { languageRoot } from "../mods/syntax/runner.mjs";
import { findLanguage } from "../mods/syntax/languages/index.js";

const installed = {
  runtime: { environment: async () => ({ version: "test" }) },
  run: async () => ({ code: 0, stdout: "test", stderr: "", problem: "" }),
};

test("adding and choosing languages keeps every enabled pack and each language's saved practice", async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-multiple-languages-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const csharpFile = join(languageRoot(root, findLanguage("csharp")), "session.json");
  const typescriptFile = join(languageRoot(root, findLanguage("typescript")), "session.json");
  assert.notEqual(csharpFile, typescriptFile);
  const csharpSession = JSON.stringify({ exerciseId: "loops/for", progress: { "loops/for": { passes: 3 } } });
  const typescriptSession = JSON.stringify({ exerciseId: "variables/constant", progress: { "variables/constant": { passes: 2 } } });
  await mkdir(dirname(typescriptFile), { recursive: true });
  await writeFile(csharpFile, csharpSession);
  await writeFile(typescriptFile, typescriptSession);
  await completeSetup(root, "neovim", "csharp", installed);
  await assert.rejects(selectLanguage(root, "typescript"), /Set up TypeScript/);
  await completeSetup(root, "neovim", "typescript", installed);
  assert.deepEqual((await setupStatus(root)).enabled, ["csharp", "typescript"]);
  for (const id of ["csharp", "typescript", "csharp"]) {
    const selected = await selectLanguage(root, id);
    assert.equal(selected.languageId, id);
    assert.deepEqual(selected.enabled, ["csharp", "typescript"]);
    assert.equal(await readFile(csharpFile, "utf8"), csharpSession);
    assert.equal(await readFile(typescriptFile, "utf8"), typescriptSession);
  }
});
