import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "../mods/syntax/process.mjs";

test("the installed symlink launches the runner and returns JSON for success and failure", async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = resolve(dirname(fileURLToPath(import.meta.url)), "../mods/syntax");
  const installed = join(root, "installed mod");
  await symlink(source, installed, process.platform === "win32" ? "junction" : "dir");
  const practice = join(root, "practice");
  const launch = (file, action) => runProcess(process.execPath, [file, practice, action]);

  const direct = await launch(join(source, "runner.mjs"), "status");
  assert.equal(direct.code, 0, direct.stderr);
  const linked = await launch(join(installed, "runner.mjs"), "status");
  assert.equal(linked.code, 0, linked.stderr);
  assert.deepEqual(JSON.parse(linked.stdout), JSON.parse(direct.stdout));
  assert.equal(JSON.parse(linked.stdout).exerciseId, "variables/integer");

  const failed = await launch(join(installed, "runner.mjs"), "unknown");
  assert.equal(failed.code, 1);
  assert.match(JSON.parse(failed.stdout).error, /Unknown action/);
});
