import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanSettings, loadSettings, saveSettings, nextOf, EDITORS } from "../mods/tutor/settings.js";
import { neovimOpenExpression } from "../mods/tutor/code.js";

test("settings fall back to defaults and keep what is valid", async () => {
  assert.deepEqual(cleanSettings(null), { editor: "neovim", agent: "claude", known: ["TypeScript", "JavaScript"] });
  assert.deepEqual(cleanSettings({ editor: "emacs", agent: "codex", known: [" Go ", 3, ""] }), { editor: "neovim", agent: "codex", known: ["Go"] });
  assert.equal(nextOf(EDITORS, "neovim"), "vscode");
  assert.equal(nextOf(EDITORS, "vscode"), "neovim");
  globalThis.herdrStub = { appHome: await mkdtemp(join(tmpdir(), "tutor-settings-")) };
  assert.equal((await loadSettings()).editor, "neovim");
  await saveSettings({ editor: "vscode", known: [] });
  assert.deepEqual(await loadSettings(), { editor: "vscode", agent: "claude", known: [] });
  assert.match(await readFile(join(globalThis.herdrStub.appHome, "data/tutor/settings.json"), "utf8"), /vscode/);
});

test("the Neovim open expression quotes paths", () => {
  assert.equal(neovimOpenExpression("/a/it's b.cs", 0), "execute('view +1 ' . fnameescape('/a/it''s b.cs'))");
  assert.equal(neovimOpenExpression("/a.cs", 12.7), "execute('view +12 ' . fnameescape('/a.cs'))");
});
