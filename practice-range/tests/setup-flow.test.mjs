import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseLayoutConfig, saveLayoutConfig, clampWidth, DEFAULT_LAYOUT } from "../mods/practice-range/layout-config.js";
import { arrangeCommands } from "../mods/practice-range/split.js";
import { scanTools } from "../mods/practice-range/setup/scan.mjs";
import { installPack } from "../mods/practice-range/setup/install.mjs";
import { neovimPanelKeyCommands } from "../mods/practice-range/editor-pane.js";

test("layout reads defaults, clamps the width, and reports wrong values", () => {
  assert.deepEqual(parseLayoutConfig(null), DEFAULT_LAYOUT);
  assert.deepEqual(parseLayoutConfig('{"editor":"neovim"}'), DEFAULT_LAYOUT);
  assert.deepEqual(parseLayoutConfig('{"layout":{"side":"right"}}'), { side: "right", width: 0.5, compact: false });
  assert.equal(parseLayoutConfig('{"layout":{"width":0.95}}').width, 0.7);
  assert.equal(parseLayoutConfig('{"layout":{"width":0.1}}').width, 0.3);
  assert.equal(clampWidth(0.4249), 0.42);
  assert.throws(() => parseLayoutConfig('{"layout":{"side":"top"}}'), /layout.side/);
  assert.throws(() => parseLayoutConfig('{"layout":{"width":"wide"}}'), /layout.width/);
  assert.throws(() => parseLayoutConfig('{"layout":{"compact":"yes"}}'), /layout.compact/);
  assert.throws(() => parseLayoutConfig('{"layout":[]}'), /layout must be an object/);
});

test("saving the layout keeps the other settings", async () => {
  let text = '{\n  "editor": "neovim",\n  "sync": true\n}\n';
  await saveLayoutConfig({ side: "right", width: 0.42, compact: true }, {
    read: async () => text,
    write: async (next, expected) => { assert.equal(expected, text); text = next; },
  });
  assert.deepEqual(JSON.parse(text), { editor: "neovim", sync: true, layout: { side: "right", width: 0.42, compact: true } });
});

test("the split grows or shrinks the left pane, and swaps before resizing", () => {
  const base = { panel: "p1", editor: "p2", total: 1000, share: 0.5 };
  // Panel on the left, wider: its right border moves right.
  assert.deepEqual(arrangeCommands({ ...base, from: "left", side: "left", width: 0.6 }),
    [{ command: "pane.resize", args: { pane: "p1", direction: "right", px: 100 } }]);
  // Panel on the left, narrower: its right border moves left.
  assert.deepEqual(arrangeCommands({ ...base, from: "left", side: "left", width: 0.35 }),
    [{ command: "pane.resize", args: { pane: "p1", direction: "left", px: 150 } }]);
  // Panel to the right and wider: Neovim, now on the left, shrinks.
  assert.deepEqual(arrangeCommands({ ...base, from: "left", side: "right", width: 0.6 }), [
    { command: "pane.swap", args: { pane: "p1", target: "p2" } },
    { command: "pane.resize", args: { pane: "p2", direction: "left", px: 100 } },
  ]);
  // Nothing to do.
  assert.deepEqual(arrangeCommands({ ...base, from: "left", side: "left", width: 0.501 }), []);
});

test("the tool scan finds packs, editors, and how many exercises passed, without installing", async t => {
  const root = await mkdtemp(join(tmpdir(), "practice-scan-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "session.json"), JSON.stringify({ progress: { "loops/for": { passes: 2 }, "loops/while": { passes: 0 }, "arrays/index": { passes: 1 } } }));
  /** @type {string[]} */
  const ran = [];
  const scan = await scanTools(root, {
    run: async (command, args) => {
      ran.push(`${command} ${args.join(" ")}`);
      if (command === "nvim") return { code: 0, stdout: "NVIM v0.11.0\nBuild type: Release\n", stderr: "", problem: "" };
      throw new Error("not found");
    },
  });
  assert.deepEqual(ran.sort(), ["code --version", "nvim --version"]);
  assert.deepEqual(scan.editors, { neovim: { found: true, version: "NVIM v0.11.0" }, vscode: { found: false, version: "" } });
  assert.equal(scan.languages.csharp.passed, 2);
  assert.equal(scan.languages.csharp.total, 800);
  assert.equal(scan.languages.typescript.passed, 0);
  assert.equal(typeof scan.languages.sql.ready, "boolean");
  assert.equal(scan.node.ready, true);
});

test("install runs npm ci in the pack's own folder and reports npm's error", async () => {
  /** @type {{ command: string, args: string[], cwd: string }[]} */
  const calls = [];
  const result = await installPack("sql", { run: async (command, args, options) => { calls.push({ command, args, cwd: options.cwd }); return { code: 0, stdout: "", stderr: "", problem: "" }; } });
  assert.deepEqual(result, { installed: "sql" });
  assert.ok(calls[0].args.includes("ci"));
  assert.match(calls[0].cwd, /languages[\\/]sql[\\/]$/);
  await assert.rejects(installPack("typescript", { run: async () => ({ code: 1, stdout: "", stderr: "npm ERR! network\nnpm ERR! offline", problem: "" }) }), /npm ci failed[\s\S]*offline/);
  await assert.rejects(installPack("typescript", { run: async () => { throw new Error("ENOENT"); } }), /npm is not available/);
  await assert.rejects(installPack("csharp"), /install yourself/);
});

test("Neovim's key back to the panel points to the panel's side", () => {
  assert.match(neovimPanelKeyCommands()[0], /<C-h>.*'left'/);
  assert.match(neovimPanelKeyCommands("right")[0], /<C-l>.*'right'/);
});
