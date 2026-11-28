import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { OptionNavigation } from "../mods/practice-range/option-navigation.js";

const main = (await readFile(new URL("../mods/practice-range/main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "").replace("export default class Syntax extends View", "globalThis.Syntax = class Syntax extends View");
const course = (await readFile(new URL("../mods/practice-range/courses/panel.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "").replace("export class CoursePanel", "globalThis.CoursePanel = class CoursePanel");
const cx = { notify() {}, stop_propagation() {} };
const event = (key, control = false) => ({ key, keystroke: `${control ? "ctrl-" : ""}${key}`, modifiers: { control, platform: false, alt: false } });

function context() {
  const scope = vm.createContext({ View: class {}, readingText() {}, props: () => ({ practiceTab: true }),
    START_CHOICES: [{ id: "languages" }, { id: "courses" }],
    sharedStorage: () => ({ getItem: () => null, setItem() {} }),
  });
  vm.runInContext(main, scope);
  vm.runInContext(course, scope);
  return scope;
}

test("hjkl moves among the rendered options and Enter selects without activating while moving", () => {
  const nav = new OptionNavigation(), calls = [];
  nav.begin("catalog");
  for (const id of ["first", "second", "third"]) nav.add(id, () => calls.push(id));
  nav.key("l", cx); nav.key("j", cx);
  assert.equal(nav.selected, "third");
  assert.deepEqual(calls, []);
  nav.key("k", cx); nav.key("h", cx); nav.key("h", cx);
  assert.equal(nav.selected, "first");
  nav.key("enter", cx);
  assert.deepEqual(calls, ["first"]);
  nav.begin("catalog");
  nav.add("second", () => calls.push("second"));
  nav.key("enter", cx);
  assert.deepEqual(calls, ["first", "second"], "A removed or disabled choice must never activate");
  nav.begin("lesson");
  assert.equal(nav.selected, "");
});

test("the home choices accept plain navigation and Ctrl-j/k and ignore keys while typing", () => {
  const scope = context(), opened = [];
  const view = Object.create(scope.Syntax.prototype);
  Object.assign(view, { screen: "start", selected: 0, shortcuts: { open: false, key: () => false, matches: () => false },
    chooseStart: id => opened.push(id) });
  view.key(event("l"), cx); assert.equal(view.selected, 1);
  view.key(event("h"), cx); assert.equal(view.selected, 0);
  view.key(event("j", true), cx); assert.equal(view.selected, 1);
  view.key(event("enter"), cx); assert.deepEqual(opened, ["courses"]);
  view.typing = true;
  view.key(event("k", true), cx); assert.equal(view.selected, 1);
});

test("course controls reserve Ctrl-h/l for pane focus and keep h for Hint", () => {
  const scope = context();
  const panel = Object.create(scope.CoursePanel.prototype), nav = new OptionNavigation();
  Object.assign(panel, { page: "task", host: { busy: "", typing: false }, navigation: nav, busy: "" });
  nav.begin("task"); nav.add("hint", () => {}); nav.add("check", () => {});
  nav.key("l", cx);
  assert.equal(panel.navigate(event("h"), cx), false);
  assert.equal(nav.selected, "check");
  assert.equal(panel.navigate(event("h", true), cx), false);
  assert.equal(panel.navigate(event("l", true), cx), false);
  assert.equal(panel.navigate(event("k", true), cx), true);
  assert.equal(nav.selected, "hint");
  panel.host.typing = true;
  assert.equal(panel.navigate(event("j", true), cx), false);
  assert.equal(nav.selected, "hint");
});

test("Ctrl-h/l focus the physical left/right pane before option navigation, typing, or settings", () => {
  const scope = context(), calls = [];
  scope.run = (command, args) => calls.push({ command, direction: args.direction });
  const view = Object.create(scope.Syntax.prototype);
  Object.assign(view, { screen: "courses", typing: true, shortcuts: { open: true, key() { throw new Error("Settings intercepted pane focus"); } },
    courses: { navigate() { throw new Error("Options intercepted pane focus"); } } });
  view.key(event("h", true), cx);
  view.key(event("l", true), cx);
  assert.deepEqual(calls, [{ command: "pane.go", direction: "left" }, { command: "pane.go", direction: "right" }]);
});

test("catalog navigation includes cards only, with Enter starting or continuing the card", async () => {
  const source = (await readFile(new URL("../mods/practice-range/courses/navigation-ui.js", import.meta.url), "utf8"))
    .replace(/^import .*;\r?\n/gm, "").replace(/^export \* .*;\r?\n/gm, "").replaceAll("export function", "function");
  const scope = vm.createContext({});
  vm.runInContext(source, scope);
  const nav = new OptionNavigation(), calls = [];
  scope.beginNavigation(nav, "catalog//");
  scope.option("course-all-languages", () => calls.push("all"));
  for (const id of ["csharp", "typescript"]) {
    scope.option(`course-card-${id}`, () => calls.push(id));
    scope.option(`course-open-${id}`, () => calls.push("button"));
    scope.option(`course-update-${id}`, () => calls.push("update-button"));
  }
  scope.option("course-back", () => calls.push("back"));
  assert.deepEqual(nav.items.map(item => item.id), ["course-card-csharp", "course-card-typescript"]);
  nav.key("l", cx); nav.key("enter", cx);
  assert.deepEqual(calls, ["typescript"]);
  nav.key("h", cx); nav.key("enter", cx);
  assert.deepEqual(calls, ["typescript", "csharp"]);
  scope.beginNavigation(nav, "task//");
  scope.option("course-check", () => {});
  assert.equal(nav.items.length, 1, "Other screens retain their button navigation");
});

test("u updates only the selected course when its update is available", () => {
  const scope = context(), panel = Object.create(scope.CoursePanel.prototype), calls = [];
  const course = { id: "typescript", enrolledVersion: "1", contentVersion: "2", versions: ["1"] };
  Object.assign(panel, { page: "catalog", busy: "", host: { busy: "" }, catalog: [course],
    navigation: { selected: "course-card-typescript" }, run: (action, request) => calls.push({ action, ...request }) });
  panel.key("u", cx);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { action: "update-version", courseId: "typescript", contentVersion: "1", to: "2" });
  course.versions.push("2"); panel.key("u", cx);
  course.enrolledVersion = "2"; panel.key("u", cx);
  panel.navigation.selected = "course-card-other"; panel.key("u", cx);
  assert.equal(calls.length, 1, "Current, already-started, and unselected courses must not update");
});
