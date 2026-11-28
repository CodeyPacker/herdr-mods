import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const viewSource = (await readFile(new URL("../mods/practice-range/main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export default class Syntax extends View", "globalThis.Syntax = class Syntax extends View");
const courseSource = (await readFile(new URL("../mods/practice-range/courses/panel.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export class CoursePanel", "globalThis.CoursePanel = class CoursePanel");

function harness(editor) {
  const context = vm.createContext({ View: class {}, readingText() {}, checking: () => false, props: () => ({ practiceTab: true }),
    sharedStorage: () => ({ getItem: () => null, setItem() {} }),
    courseCommand: async (_action, request) => ({ course: { id: "course:test", contentVersion: "1" },
      file: `/answers/${request.taskId ?? "first"}/Exercise.cs`, enrollment: { activeTask: request.taskId ?? "first" } }),
  });
  vm.runInContext(viewSource, context);
  vm.runInContext(courseSource, context);
  const opened = [];
  const view = Object.create(context.Syntax.prototype);
  const courses = Object.create(context.CoursePanel.prototype);
  Object.assign(view, { courses, editor, screen: "courses", laidOut: true, setupCompleted: false, busy: "", error: "",
    automaticEditorStarted: true, cancelTutor() {}, updateOutput: async () => {},
    openEditor() { opened.push(this.editorTarget().file); this.automaticEditorStarted = true; },
  });
  Object.assign(courses, { host: view, page: "lesson", busy: "", error: "", data: null, startWatch() {}, pause() {} });
  return { view, courses, opened, context, cx: { notify() {} } };
}

for (const editor of ["neovim", "vscode"]) test(`${editor} opens on entering course tasks and stays put during checks`, async () => {
  const { courses, opened, cx } = harness(editor);
  await courses.dispatch("task", { taskId: "first" }, cx);
  assert.deepEqual(opened, ["/answers/first/Exercise.cs"]);
  for (const action of ["check", "check-saved", "hint", "status"]) await courses.dispatch(action, {}, cx);
  assert.equal(opened.length, 1, "Checking, asking for help, and refreshing must not steal editor focus");
  await courses.dispatch("task", { taskId: "second" }, cx);
  assert.equal(opened.at(-1), "/answers/second/Exercise.cs");
  await courses.dispatch("open", {}, cx);
  assert.equal(opened.length, 2, "Reading a lesson must not open an editor");
  await courses.dispatch("task", { taskId: "second" }, cx);
  assert.equal(opened.length, 3, "Returning to an exercise opens its editor again");
});

test("reading hides Neovim and the next exercise reuses its existing session", async () => {
  const { view, courses, context, cx } = harness("neovim");
  const panel = { pane: "course-panel", zoomed: false };
  const editor = { pane: "course-editor", terminal: "existing-nvim" };
  const commands = [], files = [], jobs = [];
  context.appCommand = async (command, args) => {
    commands.push({ command, args });
    assert.equal(command, "pane.zoom", "Visibility changes must not close or kill Neovim");
    panel.zoomed = !panel.zoomed;
  };
  context.reuseNeovim = async (server, file) => { assert.equal(server, "existing-server"); files.push(file); return true; };
  context.neovimCommands = async () => true;
  context.neovimPanelKeyCommands = () => [];
  context.run = () => {};
  Object.assign(view, { ownPane: () => panel, editorPane: () => editor, server: "existing-server", layout: { side: "right" },
    openEditor: context.Syntax.prototype.openEditor });
  cx.spawn = callback => jobs.push(callback(cx));
  courses.page = "lesson";
  view.syncCourseEditor(cx);
  await Promise.all(jobs.splice(0));
  assert.equal(panel.zoomed, true);
  view.syncCourseEditor(cx);
  assert.equal(commands.length, 1, "Repeated reading renders must not toggle visibility");

  await courses.dispatch("task", { taskId: "first" }, cx);
  await Promise.all(jobs.splice(0));
  assert.equal(panel.zoomed, false);
  assert.deepEqual(files, ["/answers/first/Exercise.cs"]);
  await courses.dispatch("task", { taskId: "second" }, cx);
  await Promise.all(jobs.splice(0));
  assert.deepEqual(files, ["/answers/first/Exercise.cs", "/answers/second/Exercise.cs"]);
  assert.equal(commands.length, 2, "Consecutive exercises must keep the existing split");
});

test("course editor opening waits for the pane and requires a configured editor and file", async () => {
  const { view, courses, opened, cx } = harness("neovim");
  view.laidOut = false;
  await courses.dispatch("task", {}, cx);
  assert.equal(opened.length, 0);
  view.laidOut = true;
  view.startAutomaticEditor(cx);
  assert.equal(opened.length, 1);
  view.automaticEditorStarted = false;
  view.editor = null;
  view.startAutomaticEditor(cx);
  assert.equal(opened.length, 1);
  view.editor = "neovim";
  courses.data.file = null;
  view.startAutomaticEditor(cx);
  assert.equal(opened.length, 1);
});

test("a successful course update refreshes catalog versions before returning to the list", async () => {
  const { courses, context, cx } = harness("neovim");
  const old = { id: "course:test", enrolledVersion: "1", contentVersion: "2", versions: ["1"] };
  const current = { ...old, enrolledVersion: "2", versions: ["1", "2"] };
  courses.catalog = [old];
  courses.page = "catalog";
  context.courseCommand = async action => {
    if (action === "update-version") return { migrated: { courseId: old.id, contentVersion: "2" } };
    if (action === "list") return { courses: [current] };
    return { course: { id: old.id, contentVersion: "2" }, enrollment: {} };
  };
  await courses.dispatch("update-version", { courseId: old.id, contentVersion: "1", to: "2" }, cx);
  assert.equal(courses.error, "");
  assert.equal(courses.page, "modules");
  assert.equal(courses.data.course.contentVersion, "2");
  assert.equal(courses.catalog[0].enrolledVersion, "2");
  assert.deepEqual(courses.catalog[0].versions, ["1", "2"]);
  courses.back(cx);
  assert.equal(courses.page, "catalog");
  assert.equal(courses.catalog[0], current, "Back must show the refreshed summary, without its update button");
});
