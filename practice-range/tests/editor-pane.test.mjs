import { test } from "node:test";
import assert from "node:assert/strict";
import { findPracticePane } from "../mods/practice-range/editor-pane.js";

const first = { pane: "practice-one", tab: "tab-one", mod: "practice-range" };
const second = { pane: "practice-two", tab: "tab-two", mod: "practice-range" };
const terminal = { pane: "editor-one", tab: "tab-one", terminal: "nvim-one" };

test("the editor stays anchored to its practice tab after focus moves elsewhere", () => {
  assert.equal(findPracticePane([first, second, terminal], first.pane, { pane: second.pane, tab: second.tab }, null), first);
  assert.equal(findPracticePane([first, second, terminal], null, { pane: second.pane, tab: second.tab }, first.pane), first);
});

test("a restored tab finds its practice pane while its Neovim split has focus", () => {
  assert.equal(findPracticePane([first, second, terminal], null, { pane: terminal.pane, tab: terminal.tab }, null), first);
});

test("an unresolved or ambiguous tab never chooses an arbitrary practice pane", () => {
  assert.equal(findPracticePane([], null, null, null), null);
  assert.equal(findPracticePane([first, second], null, { pane: "elsewhere", tab: "other-tab" }, null), null);
  assert.equal(findPracticePane([first], null, null, null), first);
});
