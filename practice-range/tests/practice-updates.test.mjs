import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { defaultLanguage, findLanguage } from "../mods/practice-range/languages/index.js";
import { catalogFor } from "../mods/practice-range/catalog.js";

// Load the actual view methods without Herdr's native rendering imports.
const source = (await readFile(new URL("../mods/practice-range/main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export default class Syntax extends View", "globalThis.Syntax = class Syntax extends View");

function harness() {
  let resolve, reject;
  const response = new Promise((yes, no) => { resolve = yes; reject = no; });
  const calls = [], jobs = [];
  let notifications = 0;
  const context = vm.createContext({ View: class {}, findLanguage,
    practiceCommand: async (action, value) => { calls.push({ action, value }); return response; },
    localStorage: { setItem() {} },
    sharedStorage: () => ({ getItem: () => null, setItem() {} }),
  });
  vm.runInContext(source, context);
  const view = new context.Syntax();
  const state = { languageId: "csharp", exerciseId: "loops/for", hintCount: 0, answerShown: false, progress: {}, result: null };
  Object.assign(view, { state, language: defaultLanguage, catalog: catalogFor(defaultLanguage), recent: {}, editorSettingsLoaded: true,
    busy: "", practicePending: false, watching: true, screen: "practice", startAutomaticEditor() {} });
  const cx = { notify() { notifications++; }, spawn(callback) { jobs.push(callback(cx)); } };
  return { view, cx, state, calls, jobs, resolve, reject, notifications: () => notifications };
}

for (const action of ["hint", "answer"]) test(`${action} updates once without flashing loading controls and still serializes actions`, async () => {
  const h = harness();
  h.view.perform(action, null, h.cx);
  assert.equal(h.view.busy, "", "The loading row and disabled-control styling must stay unchanged");
  assert.equal(h.view.practicePending, true);
  assert.equal(h.notifications(), 0, "Do not redraw before help arrives");
  h.view.action("check", h.cx);
  h.view.perform("select", "loops/foreach", h.cx);
  assert.equal(h.calls.length, 1, "A quiet request must still block overlapping session commands");
  const updated = { ...h.state, hintCount: action === "hint" ? 1 : 0, answerShown: action === "answer" };
  h.resolve(updated);
  await Promise.all(h.jobs);
  assert.equal(h.view.state, updated);
  assert.equal(h.view.practicePending, false);
  assert.equal(h.notifications(), 1, "Render the revealed help once");
});

test("failed help requests unlock the controls and preserve the current exercise", async () => {
  const h = harness();
  h.view.perform("hint", null, h.cx);
  h.reject(new Error("Could not save the hint"));
  await Promise.all(h.jobs);
  assert.equal(h.view.practicePending, false);
  assert.equal(h.view.state, h.state);
  assert.match(h.view.error, /Could not save the hint/);
  assert.equal(h.notifications(), 1);
});

test("code checks retain their visible loading status", async () => {
  const h = harness();
  h.view.perform("check", null, h.cx);
  assert.equal(h.view.busy, "Checking C#…");
  assert.equal(h.notifications(), 1);
  h.resolve(h.state);
  await Promise.all(h.jobs);
  assert.equal(h.view.busy, "");
  assert.equal(h.view.practicePending, false);
});
