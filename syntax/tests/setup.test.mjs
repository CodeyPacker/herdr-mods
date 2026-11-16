import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRequirements, setupStatus, completeSetup } from "../mods/syntax/setup.mjs";
import { command } from "../mods/syntax/runner.mjs";

test("setup reports missing runtimes and editor commands without attempting installation", async () => {
  const missing = await checkRequirements("neovim", {
    runtime: { environment: async () => { throw new Error("Install a .NET SDK (8 or newer), then recheck."); } },
    run: async (command, args) => {
      assert.equal(command, "nvim");
      assert.deepEqual(args, ["--version"]);
      throw new Error("not found");
    },
  });
  assert.equal(missing.language.ready, false);
  assert.match(missing.language.detail, /Install a .NET SDK/);
  assert.equal(missing.editor.ready, false);
  assert.match(missing.editor.detail, /nvim/);
  const available = await checkRequirements("vscode", {
    runtime: { environment: async () => ({ version: "10.0.301" }) },
    run: async (command, args) => {
      assert.equal(command, "code");
      assert.deepEqual(args, ["--version"]);
      return { code: 0, stdout: "1.0", stderr: "", problem: "" };
    },
  });
  assert.equal(available.language.ready, true);
  assert.equal(available.editor.ready, true);
});

test("setup completion persists separately and never resets practice or editor preferences", async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-setup-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const session = JSON.stringify({ exerciseId: "loops/for", progress: { "loops/for": { passes: 3 } } });
  await writeFile(join(root, "session.json"), session);
  assert.deepEqual(await command(root, "setup-status"), { completed: false, languageId: "csharp", enabled: [] });
  await assert.rejects(completeSetup(root, null), /Finish the requirement and editor checks/);
  assert.deepEqual(await setupStatus(root), { completed: false, languageId: "csharp", enabled: [] });
  assert.deepEqual(await completeSetup(root, "neovim"), { completed: true, languageId: "csharp", enabled: ["csharp"] });
  assert.deepEqual(await command(root, "setup-status"), { completed: true, languageId: "csharp", enabled: ["csharp"] });
  assert.equal(await readFile(join(root, "session.json"), "utf8"), session);
  await writeFile(join(root, "setup.json"), "broken");
  await assert.rejects(setupStatus(root), /Cannot read setup.json/);
});

test("setup files written before language packs read as C# enabled", async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-setup-v1-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "setup.json"), JSON.stringify({ version: 1, completed: true, languageId: "csharp" }));
  assert.deepEqual(await setupStatus(root), { completed: true, languageId: "csharp", enabled: ["csharp"] });
  await writeFile(join(root, "setup.json"), JSON.stringify({ version: 2, languageId: "python", enabled: ["python", "typescript"] }));
  assert.deepEqual(await setupStatus(root), { completed: true, languageId: "typescript", enabled: ["typescript"] }, "Unknown packs are ignored");
});

test("TypeScript setup checks its own pinned compiler and explains the separate install", async () => {
  const missing = await checkRequirements(null, {
    languageId: "typescript",
    runtime: { environment: async () => { throw new Error("Install this pack's TypeScript compiler (6.0.3): run npm ci in /pack, then recheck."); } },
  });
  assert.equal(missing.language.ready, false);
  assert.match(missing.language.detail, /npm ci/);
  assert.equal(missing.node.ready, true);
  const real = await checkRequirements(null, { languageId: "typescript" });
  assert.equal(real.language.ready, true, real.language.detail);
  assert.equal(real.language.detail, "TypeScript: TypeScript 6.0.3");
  await assert.rejects(checkRequirements(null, { languageId: "../outside" }), /Language pack is not installed/);
});
