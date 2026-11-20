// Reading git's output: the changed files, a diff, the branches and the log.
// No imports, so plain node can load this file.

/**
 * One row of the file list. A file with both staged and unstaged changes has two rows.
 * @typedef {object} FileEntry
 * @property {string} path from the repo's top folder, with forward slashes
 * @property {boolean} staged this row is in the staging area
 * @property {"M" | "A" | "D" | "U" | "!"} status modified, added, deleted, untracked, in conflict
 * @property {boolean} untracked git does not know the file yet
 * @property {number} add lines added
 * @property {number} del lines removed
 * @property {boolean} binary git has no line counts for it
 */

/** @typedef {{ add: number, del: number, binary: boolean }} Stat */

/**
 * Parses `git diff --numstat -z --no-renames`: the lines added and removed per file.
 * @param {string} text @returns {Map<string, Stat>}
 */
export function parseNumstat(text) {
  /** @type {Map<string, Stat>} */
  const stats = new Map();
  for (const entry of String(text ?? "").split("\0")) {
    const [add, del, ...parts] = entry.split("\t");
    if (!parts.length) continue;
    stats.set(parts.join("\t"), { add: Number(add) || 0, del: Number(del) || 0, binary: add === "-" });
  }
  return stats;
}

const LOCK_NAMES = new Set(["package-lock.json", "pnpm-lock.yaml", "packages.lock.json", "bun.lockb", "go.sum", "npm-shrinkwrap.json"]);
const TEST_FOLDERS = /(^|\/)(tests?|__tests__|specs?|e2e|__mocks__|__snapshots__|[^/]*\.tests?)\//;
const TEST_NAMES = /(\.(test|spec)\.[^/.]+|_test\.[^/.]+|tests?\.(cs|java|kt)|\.snap)$|(^|\/)test_[^/]*\.py$/;
const MADE_FOLDERS = /(^|\/)(dist|build|out|generated|__generated__)\//;
const MADE_NAMES = /(\.generated\.[^/.]+|\.g\.(cs|dart)|\.designer\.cs|\.min\.(js|css)|\.map|\.pb\.go|_pb2\.py)$/;

/**
 * How far down the list a file belongs: 0 for the files worth reading first, then tests (1),
 * package.json (2), files a tool wrote (3) and lock files (4).
 * @param {string} path
 */
export function rankOf(path) {
  const p = path.toLowerCase();
  const name = p.slice(p.lastIndexOf("/") + 1);
  if (LOCK_NAMES.has(name) || name.endsWith(".lock")) return 4;
  if (MADE_FOLDERS.test(p) || MADE_NAMES.test(name)) return 3;
  if (name === "package.json") return 2;
  if (TEST_FOLDERS.test(p) || TEST_NAMES.test(p)) return 1;
  return 0;
}

/** The order of two rows in a list: by rank, then by path. @param {FileEntry} a @param {FileEntry} b */
export function compareFiles(a, b) {
  return rankOf(a.path) - rankOf(b.path) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

/**
 * Parses `git status --porcelain=v1 -z --no-renames --untracked-files=all` into the two lists,
 * each in compareFiles order.
 * @param {string} text
 * @param {Map<string, Stat>} stagedStats line counts of the staged changes
 * @param {Map<string, Stat>} changeStats line counts of the unstaged changes
 * @returns {{ staged: FileEntry[], changes: FileEntry[] }}
 */
export function parseStatus(text, stagedStats, changeStats) {
  /** @type {FileEntry[]} */
  const staged = [];
  /** @type {FileEntry[]} */
  const changes = [];
  const none = { add: 0, del: 0, binary: false };
  for (const entry of String(text ?? "").split("\0")) {
    if (entry.length < 4) continue;
    const x = entry[0], y = entry[1], path = entry.slice(3);
    if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) {
      changes.push({ path, staged: false, status: "!", untracked: false, ...(changeStats.get(path) ?? none) });
      continue;
    }
    if (x !== " " && x !== "?") {
      staged.push({ path, staged: true, status: x === "A" ? "A" : x === "D" ? "D" : "M", untracked: false, ...(stagedStats.get(path) ?? none) });
    }
    if (y !== " ") {
      const untracked = y === "?";
      changes.push({ path, staged: false, status: untracked ? "U" : y === "D" ? "D" : y === "A" ? "A" : "M", untracked, ...(changeStats.get(path) ?? none) });
    }
  }
  return { staged: staged.sort(compareFiles), changes: changes.sort(compareFiles) };
}

/**
 * One file's diff. `header` is every line before the first hunk. Lines are git's own, unchanged,
 * so a hunk can be handed back to `git apply`.
 * @typedef {{ header: string[], hunks: { head: string, lines: string[] }[] }} Diff
 */

/**
 * Parses the output of `git diff` for one file.
 * @param {string} raw git's output, not trimmed @returns {Diff}
 */
export function parseDiff(raw) {
  const all = String(raw ?? "").split("\n");
  if (all[all.length - 1] === "") all.pop();
  /** @type {Diff} */
  const diff = { header: [], hunks: [] };
  for (const line of all) {
    if (line.startsWith("@@")) diff.hunks.push({ head: line, lines: [] });
    else if (diff.hunks.length) diff.hunks[diff.hunks.length - 1].lines.push(line);
    else diff.header.push(line);
  }
  return diff;
}

/**
 * A diff for a file git does not know yet: every line added.
 * @param {string} text the file's text @returns {Diff}
 */
export function newFileDiff(text) {
  const lines = String(text ?? "").replace(/\n$/, "").split("\n");
  return { header: [], hunks: [{ head: `@@ -0,0 +1,${lines.length} @@`, lines: lines.map((l) => `+${l}`) }] };
}

/**
 * A patch that holds one hunk of a diff, for `git apply --cached`.
 * @param {Diff} diff @param {number} i the hunk's place
 */
export function hunkPatch(diff, i) {
  const h = diff.hunks[i];
  return [...diff.header, h.head, ...h.lines].join("\n") + "\n";
}

/** The longest line the diff view draws. */
const MAX_LINE = 2000;

/**
 * A diff line's text, ready to draw: no leading mark, no carriage return, and each tab padded
 * to the next 4-column stop (text draws a tab as nothing).
 * @param {string} line
 */
function shown(line) {
  const text = line.slice(1).replace(/\r$/, "").replace(/[^\t]*\t/g, (s) => s.slice(0, -1).padEnd((s.length - 1) - (s.length - 1) % 4 + 4));
  return text.length > MAX_LINE ? `${text.slice(0, MAX_LINE)}…` : text;
}

/** One side of a diff row. `n` is the line number. `tokens` are its colored pieces, set by colorRows. @typedef {{ kind: "+" | "-" | " ", n: number, text: string, tokens?: import("./syntax.js").Token[] }} Side */

/**
 * A row of the unified view: a hunk's heading, a line, or git's own remark.
 * @typedef {{ kind: "@", hunk: number, text: string } | { kind: "+" | "-" | " ", old: number | null, next: number | null, text: string, tokens?: import("./syntax.js").Token[] } | { kind: "", text: string }} UnifiedRow
 */

/**
 * A row of the split view: a hunk's heading, or the old line beside the new one. A missing side is null.
 * @typedef {{ kind: "@", hunk: number, text: string } | { kind: "pair", left: Side | null, right: Side | null }} SplitRow
 */

/** Where a hunk starts in the old and the new file. @param {string} head */
function startOf(head) {
  const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(head);
  return { old: Number(m?.[1] ?? 0), next: Number(m?.[2] ?? 0) };
}

/** The rows of the unified view: old and new lines in one column. @param {Diff} diff @returns {UnifiedRow[]} */
export function unifiedRows(diff) {
  /** @type {UnifiedRow[]} */
  const rows = [];
  diff.hunks.forEach((h, i) => {
    let { old, next } = startOf(h.head);
    rows.push({ kind: "@", hunk: i, text: h.head });
    for (const line of h.lines) {
      const k = line[0];
      if (k === "-") rows.push({ kind: "-", old: old++, next: null, text: shown(line) });
      else if (k === "+") rows.push({ kind: "+", old: null, next: next++, text: shown(line) });
      else if (k === " " || line === "") rows.push({ kind: " ", old: old++, next: next++, text: shown(line) });
      else rows.push({ kind: "", text: line });
    }
  });
  return rows;
}

/** The rows of the split view: each removed line beside the added line that replaced it. @param {Diff} diff @returns {SplitRow[]} */
export function splitRows(diff) {
  /** @type {SplitRow[]} */
  const rows = [];
  diff.hunks.forEach((h, i) => {
    let { old, next } = startOf(h.head);
    rows.push({ kind: "@", hunk: i, text: h.head });
    /** @type {Side[]} removed lines waiting for the added lines that follow them */
    let removed = [];
    /** @type {Side[]} */
    let added = [];
    const flush = () => {
      for (let j = 0; j < Math.max(removed.length, added.length); j++) rows.push({ kind: "pair", left: removed[j] ?? null, right: added[j] ?? null });
      removed = [];
      added = [];
    };
    for (const line of h.lines) {
      const k = line[0];
      if (k === "-") {
        if (added.length) flush();
        removed.push({ kind: "-", n: old++, text: shown(line) });
      } else if (k === "+") added.push({ kind: "+", n: next++, text: shown(line) });
      else if (k === " " || line === "") {
        flush();
        const text = shown(line);
        rows.push({ kind: "pair", left: { kind: " ", n: old++, text }, right: { kind: " ", n: next++, text } });
      }
    }
    flush();
  });
  return rows;
}

/**
 * One branch of a repo.
 * @typedef {object} Branch
 * @property {string} name local "feature/x", remote "origin/feature/x"
 * @property {"local" | "remote"} kind
 * @property {string | null} remote "origin" for a remote branch, null for a local one
 * @property {boolean} current checked out in this folder
 * @property {string} upstream a short name such as "origin/main", "" when none
 * @property {number} ahead commits the upstream does not have
 * @property {number} behind commits only the upstream has
 * @property {boolean} gone the upstream was deleted
 * @property {number} at the last commit's time in unix seconds
 */

/** The `--format` for `git for-each-ref`. Git writes the unit separator (\x1f) for each %1f, and one ref per line. */
export const REF_FORMAT = "%(refname)%1f%(HEAD)%1f%(upstream:short)%1f%(upstream:track)%1f%(committerdate:unix)";

const LOCAL = "refs/heads/";
const REMOTE = "refs/remotes/";

/**
 * Parses `git for-each-ref --format=<REF_FORMAT> refs/heads refs/remotes`, sorted: local before
 * remote, then the current branch, then the newest commit.
 * @param {string} text @returns {Branch[]}
 */
export function parseBranches(text) {
  /** @type {Branch[]} */
  const out = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const [ref = "", head = "", upstream = "", track = "", date = ""] = line.split("\x1f");
    if (ref.endsWith("/HEAD")) continue;
    const local = ref.startsWith(LOCAL);
    if (!local && !ref.startsWith(REMOTE)) continue;
    const name = ref.slice((local ? LOCAL : REMOTE).length);
    if (!name) continue;
    out.push({
      name,
      kind: local ? "local" : "remote",
      remote: local ? null : name.split("/")[0],
      current: head === "*",
      upstream,
      ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
      behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0),
      gone: track.includes("gone"),
      at: Number(date) || 0,
    });
  }
  return out.sort((a, b) =>
    Number(a.kind === "remote") - Number(b.kind === "remote")
    || Number(b.current) - Number(a.current)
    || b.at - a.at
    || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * The branches to list: those whose name holds every word of `text`, ignoring case. A remote
 * branch that a local branch tracks is left out, since the local row stands for it.
 * @param {Branch[]} branches @param {string} text words split on spaces @returns {Branch[]}
 */
export function listBranches(branches, text) {
  const tracked = new Set(branches.filter((b) => b.kind === "local" && b.upstream).map((b) => b.upstream));
  const words = String(text ?? "").toLowerCase().split(" ").filter(Boolean);
  return branches.filter((b) => {
    if (b.kind === "remote" && tracked.has(b.name)) return false;
    const name = b.name.toLowerCase();
    return words.every((w) => name.includes(w));
  });
}

/** One commit of the log. `when` is git's own words, such as "2 hours ago". @typedef {{ sha: string, subject: string, when: string }} Commit */

/** The `--format` for `git log`: short sha, subject and age, split by the unit separator. */
export const LOG_FORMAT = "%h%x1f%cr%x1f%s";

/** Parses `git log --format=<LOG_FORMAT>`. @param {string} text @returns {Commit[]} */
export function parseLog(text) {
  return String(text ?? "").split(/\r?\n/).filter((l) => l.includes("\x1f")).map((line) => {
    const [sha = "", when = "", ...subject] = line.split("\x1f");
    return { sha, when, subject: subject.join("\x1f") };
  });
}

/**
 * A commit message as the agent wrote it, without a code fence or quotes around it.
 * @param {string} text
 */
export function cleanMessage(text) {
  let out = String(text ?? "").replace(/\r/g, "").trim();
  const fenced = /^```[a-z]*\n([\s\S]*?)\n```$/.exec(out);
  if (fenced) out = fenced[1].trim();
  if (out.length > 1 && out.startsWith("\"") && out.endsWith("\"")) out = out.slice(1, -1).trim();
  return out;
}
