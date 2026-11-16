import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEditorConfig, saveEditorConfig } from "../mods/syntax/editor-config.js";

test("missing editor preferences require a choice and configured editors are respected", () => {
  for (const text of [null, "", "{}", '{"editor":null}', '{"editor":""}']) assert.equal(parseEditorConfig(text), null);
  assert.equal(parseEditorConfig('{"editor":"neovim"}'), "neovim");
  assert.equal(parseEditorConfig('{"editor":"vscode"}'), "vscode");
});

test("saving the first editor creates a configuration only after an explicit save", async () => {
  let contents = null;
  await saveEditorConfig("neovim", {
    read: async () => contents,
    write: async (text, expected) => { assert.equal(expected, null); contents = text; },
  });
  assert.deepEqual(JSON.parse(contents), { editor: "neovim" });
  assert.equal(parseEditorConfig(contents), "neovim");
});

test("saving a default preserves unrelated configuration values", async () => {
  const previous = '{"custom":{"enabled":true},"editor":null,"fontSize":14}';
  let written;
  await saveEditorConfig("vscode", {
    read: async () => previous,
    write: async (text, expected) => { assert.equal(expected, previous); written = text; },
  });
  assert.deepEqual(JSON.parse(written), { custom: { enabled: true }, editor: "vscode", fontSize: 14 });
});

test("invalid and concurrently changed configuration is never overwritten", async () => {
  let writes = 0;
  await assert.rejects(saveEditorConfig("neovim", {
    read: async () => "broken",
    write: async () => { writes++; },
  }), /valid JSON/);
  assert.equal(writes, 0);

  let contents = "{}";
  const changed = '{"editor":"vscode","custom":true}';
  await assert.rejects(saveEditorConfig("neovim", {
    read: async () => { const previous = contents; contents = changed; return previous; },
    write: async (text, expected) => { if (expected !== contents) throw new Error("Config changed"); contents = text; },
  }), /Config changed/);
  assert.equal(contents, changed);
});

test("invalid settings produce actionable errors rather than silently opening the wrong editor", () => {
  assert.throws(() => parseEditorConfig("broken"), /valid JSON/);
  assert.throws(() => parseEditorConfig("[]"), /configuration object/);
  assert.throws(() => parseEditorConfig("null"), /configuration object/);
  assert.throws(() => parseEditorConfig('{"editor":"vim"}'), /neovim.*vscode/);
});
