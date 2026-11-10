// Fixed lists and tables Tourist reads from. No state lives here.

export const SCOPES = [
  { key: "b", id: "branch", label: "Branch changes", hint: "since this branch left the base, plus uncommitted edits" },
  { key: "c", id: "commit", label: "Last commit", hint: "HEAD only" },
  { key: "p", id: "pr", label: "Pull request", hint: "pick an open PR for a guided review" },
  { key: "r", id: "repo", label: "Whole repo", hint: "slower, the agent surveys the codebase" },
  { key: "f", id: "feature", label: "A feature", hint: "describe it, the agent finds the code" },
];
export const DEPTHS = [
  { key: "1", id: "overview", label: "Overview", text: "Plain language. Say what each part does and why it exists. 2 to 4 sentences per stop. No jargon." },
  { key: "2", id: "normal", label: "Normal", text: "Explain what the code does and how the pieces connect. 4 to 6 sentences per stop. Name the key functions and types." },
  { key: "3", id: "deep", label: "Deep", text: "Technical. Explain mechanisms, data flow, edge cases and tradeoffs. Up to 10 sentences per stop." },
];
// Read-only tools. Claude can look at the repo but never change it.
export const TOOLS = ["--allowedTools", "Read", "Grep", "Glob", "Bash(git diff:*)", "Bash(git log:*)", "Bash(git show:*)", "Bash(git status:*)"];
// A fix run may also edit files. It runs in its own worktree, and still can't run other commands.
export const FIX_TOOLS = ["--allowedTools", "Read", "Grep", "Glob", "Edit", "MultiEdit", "Write", "Bash(git diff:*)", "Bash(git status:*)"];
// The agents a tour can use, in the order Tourist prefers them.
export const AGENTS = [{ id: "claude", name: "Claude" }, { id: "codex", name: "Codex" }];
// File extensions the editor highlights with another language's grammar.
export const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
export const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
// Panes at least this wide put the code beside the explanation.
export const SPLIT_WIDTH = 1100;
