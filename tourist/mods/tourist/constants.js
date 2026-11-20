// Fixed lists and tables Tourist reads from. No state lives here.

export const SCOPES = [
  { key: "b", id: "branch", label: "Branch changes", hint: "since this branch left the base, plus uncommitted edits" },
  { key: "c", id: "commit", label: "Last commit", hint: "HEAD only" },
  { key: "p", id: "pr", label: "Pull request", hint: "pick an open PR for a guided review" },
  { key: "r", id: "repo", label: "Whole repo", hint: "slower, the agent surveys the codebase" },
  { key: "f", id: "feature", label: "A feature", hint: "describe it, the agent finds the code" },
];
export const DEPTHS = [
  { key: "1", id: "overview", label: "Overview", text: "Very simple words, for someone new to this code. 1 to 2 short sentences per stop: what this part does and why it's here. No jargon and no function names." },
  { key: "2", id: "normal", label: "Normal", text: "Simple words and short sentences. 2 to 3 sentences per stop: what this code does and how it connects to the stop before. Name a function only when the reader needs it to follow along. The reader can ask for more detail." },
  { key: "3", id: "deep", label: "Deep", text: "Technical. Explain mechanisms, data flow, edge cases and tradeoffs. Up to 10 sentences per stop." },
];
// The re-review step, shown for a PR you reviewed before at an older head.
export const PASSES = [
  { key: "s", id: "since", label: "Changes since your last review" },
  { key: "w", id: "whole", label: "The whole PR", hint: "every change, as on a first review" },
];
/**
 * The keys a user can turn off or change in the settings. A letter that does different things on
 * different screens has an entry per thing. The arrows, the letters and numbers that pick a row,
 * enter, tab, esc, b for back, q, y and n always work, and so does every button. A row marked
 * `fixed` stands for several keys, so its keys cannot be changed.
 * @type {import("./kit/shortcuts.js").Shortcut[]}
 */
export const SHORTCUTS = [
  { id: "next", key: "j", what: "next stop" },
  { id: "prev", key: "k", what: "previous stop" },
  { id: "scroll-down", key: "shift-j", what: "scroll the code down" },
  { id: "scroll-up", key: "shift-k", what: "scroll the code up" },
  { id: "deeper", key: "d", what: "go deeper on this stop" },
  { id: "technical", key: "t", what: "explain more technically" },
  { id: "ask", key: "a  /", what: "ask about this stop", fixed: true },
  { id: "explain", key: "e", what: "explain this file, or why a check failed" },
  { id: "open", key: "o", what: "open the file, PR, check or review" },
  { id: "split", key: "s", what: "code beside or above the text" },
  { id: "files", key: "b", what: "show or hide the file list (PR tour)" },
  { id: "viewed", key: "v", what: "mark the file viewed" },
  { id: "review", key: "p", what: "review the PR, and post the review" },
  { id: "fix", key: "f", what: "fix your comments" },
  { id: "checks", key: "c", what: "open the checks" },
  { id: "merge", key: "m", what: "merge screen, and merge there" },
  { id: "replan", key: "r", what: "plan a saved tour again" },
  { id: "refresh", key: "r", what: "refresh the checks" },
  { id: "reply", key: "r a /", what: "reply to the fix agent", fixed: true },
  { id: "push", key: "p", what: "push the fix" },
  { id: "discard", key: "x", what: "discard the fix" },
  { id: "agent", key: "a", what: "switch agent (setup)" },
  { id: "zoom", key: "z", what: "zoom this pane" },
];
// Read-only tools. Claude can look at the repo but never change it.
export const TOOLS = ["--allowedTools", "Read", "Grep", "Glob", "Bash(git diff:*)", "Bash(git log:*)", "Bash(git show:*)", "Bash(git status:*)"];
// A fix run may also edit files. It runs in its own worktree, and still can't run other commands.
export const FIX_TOOLS = ["--allowedTools", "Read", "Grep", "Glob", "Edit", "MultiEdit", "Write", "Bash(git diff:*)", "Bash(git status:*)"];
// The agents a tour can use, in the order Tourist prefers them.
export const AGENTS = [{ id: "claude", name: "Claude" }, { id: "codex", name: "Codex" }];
// File extensions the editor highlights with another language's grammar.
export const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
// Panes at least this wide put the code beside the explanation.
export const SPLIT_WIDTH = 1100;
