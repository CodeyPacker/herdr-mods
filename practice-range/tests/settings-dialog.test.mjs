import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = (await readFile(new URL("../mods/practice-range/main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "").replace("export default class Syntax extends View", "globalThis.Syntax = class Syntax extends View");
function harness() {
  const scope = vm.createContext({ View: class {}, sharedStorage: () => ({ getItem: () => null }) });
  vm.runInContext(source, scope);
  const view = Object.create(scope.Syntax.prototype), calls = [];
  const cx = { notify() {}, stop_propagation() {} };
  Object.assign(view, { screen: "courses", state: { exerciseId: "saved-drill" }, handle: { focus() {} },
    setup: { page: "hub", scan() { calls.push("scan"); } },
    courses: { page: "lesson", data: { course: { id: "saved-course" } }, syncReadingSliders() {}, refreshSettings() { calls.push("refresh"); } },
    shortcuts: { open: false, openKey: ",", capturing: null,
      show() { if (!this.open) { this.open = true; view.settingsOpened(cx); } }, hide() { this.open = false; },
      key(event) { calls.push(event.key); this.capturing = null; } },
  });
  return { view, calls, cx };
}
const key = value => ({ key: value, keystroke: value, modifiers: {} });

test("setup opens in the shared settings dialog without changing the current lesson or session", () => {
  const { view, calls, cx } = harness(), session = view.state, lesson = view.courses.data;
  view.openSetup("layout", cx);
  assert.equal(view.settingsOpen, true);
  assert.equal(view.settingsTab, "layout");
  assert.equal(view.setup.page, "layout");
  assert.deepEqual(calls, ["scan", "refresh"]);
  assert.equal(view.screen, "courses");
  assert.equal(view.courses.page, "lesson");
  assert.equal(view.courses.data, lesson);
  view.selectSettingsTab("courses", cx);
  view.key(key("escape"), cx);
  assert.equal(view.settingsOpen, false);
  assert.equal(view.state, session);
  assert.equal(view.courses.data, lesson);
});

test("settings consumes keys and preserves keyboard rebinding's two-stage Escape", () => {
  const { view, calls, cx } = harness();
  view.openSetup("hub", cx);
  view.selectSettingsTab("keyboard", cx);
  view.shortcuts.capturing = "check";
  view.key(key("escape"), cx);
  assert.equal(view.settingsOpen, true);
  assert.equal(view.shortcuts.capturing, null);
  view.key(key("escape"), cx);
  assert.equal(view.settingsOpen, false);
  assert.ok(calls.includes("escape"));
});

test("opening settings again uses the same dialog and tab changes don't navigate the course", () => {
  const { view, calls, cx } = harness();
  view.openSetup("hub", cx);
  view.openSetup("editor", cx);
  assert.deepEqual(calls, ["scan", "refresh"]);
  view.selectSettingsTab("languages", cx);
  assert.equal(view.settingsTab, "languages");
  assert.equal(view.courses.page, "lesson");
  view.closeSettings(cx);
  assert.equal(view.shortcuts.open, false);
});
