import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command } from "../mods/syntax/runner.mjs";

test("setup accepts editor names from already-open tabs and structured language requests", async t => {
  const root = await mkdtemp(join(tmpdir(), "syntax-setup-request-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const editor of ["neovim", "vscode"]) {
    const legacy = await command(root, "setup-check", editor);
    const current = await command(root, "setup-check", JSON.stringify({ editor, languageId: "csharp" }));
    assert.deepEqual(legacy, current);
    assert.equal(typeof legacy.editor.ready, "boolean");
  }
  const legacyCompletion = await command(root, "setup-complete", "neovim");
  const currentCompletion = await command(root, "setup-complete", JSON.stringify({ editor: "neovim", languageId: "csharp" }));
  assert.equal(legacyCompletion.completed, true);
  assert.deepEqual(legacyCompletion, currentCompletion);
});
