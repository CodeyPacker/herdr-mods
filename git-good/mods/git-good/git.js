// Runs git through the app. Arguments always go to exec as separate array items, never as a
// shell string.
import { exec, readTextFile, writeTextFile, appHome } from "herdr";
import * as fs from "fs/promises";
import { REF_FORMAT, LOG_FORMAT, parseBranches, parseStatus, parseNumstat, parseDiff, newFileDiff, parseLog } from "./parse.js";

/** @typedef {import("./parse.js").Branch} Branch */
/** @typedef {import("./parse.js").FileEntry} FileEntry */
/** @typedef {import("./parse.js").Diff} Diff */
/** @typedef {import("./parse.js").Commit} Commit */
/** @typedef {{ ok: boolean, out: string, err: string }} GitResult `err` is git's message: stderr, or stdout when stderr is empty */
/** @typedef {{ top: string, name: string }} Repo `top` is the repo's top folder, `name` is its last part */

/** Reads change nothing under .git, and a path is always a plain path, never a pattern. */
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false"];
const PLAIN_PATHS = "--literal-pathspecs";

/** How long a pull, a push or a commit (its hooks) may take, in milliseconds. */
const SLOW_MS = 120000;

/**
 * Runs git in a folder. Never throws: a git that cannot start comes back as `ok: false`.
 * `out` is trimmed unless `raw` is set.
 * @param {string} cwd @param {string[]} args @param {string | null} [on] a space's machine, or null for this computer
 * @param {{ timeout?: number, raw?: boolean }} [o]
 * @returns {Promise<GitResult>}
 */
export async function git(cwd, args, on, o = {}) {
  try {
    const r = await exec("git", args, { cwd, on: on ?? null, ...(o.timeout === undefined ? {} : { timeout: o.timeout }) });
    const out = o.raw ? r.stdout ?? "" : (r.stdout ?? "").trim();
    const err = (r.stderr ?? "").trim();
    return { ok: r.code === 0, out, err: err || out.trim() };
  } catch (e) {
    return { ok: false, out: "", err: e instanceof Error ? e.message : String(e) };
  }
}

/** The repo a folder is in, or null when it is not in one. @param {string} folder @param {string | null} [on] @returns {Promise<Repo | null>} */
export async function repoOf(folder, on) {
  const r = await git(folder, ["rev-parse", "--show-toplevel"], on);
  if (!r.ok || !r.out) return null;
  return { top: r.out, name: r.out.split(/[\\/]/).filter(Boolean).pop() ?? r.out };
}

/**
 * The changed files in two lists, and the number of stash entries.
 * @param {Repo} repo @param {string | null} on
 * @returns {Promise<{ staged: FileEntry[], changes: FileEntry[], stashes: number, error: string }>}
 */
export async function loadStatus(repo, on) {
  const [status, stagedStats, changeStats, stashes] = await Promise.all([
    git(repo.top, [...READ, "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], on, { raw: true }),
    git(repo.top, [...READ, "diff", "--cached", "--numstat", "-z", "--no-renames"], on, { raw: true }),
    git(repo.top, [...READ, "diff", "--numstat", "-z", "--no-renames"], on, { raw: true }),
    git(repo.top, ["stash", "list"], on),
  ]);
  if (!status.ok) return { staged: [], changes: [], stashes: 0, error: status.err || "git could not read the changes" };
  const lists = parseStatus(status.out, parseNumstat(stagedStats.out), parseNumstat(changeStats.out));
  return { ...lists, stashes: stashes.ok ? stashes.out.split(/\r?\n/).filter((l) => l.trim()).length : 0, error: "" };
}

/**
 * The repo's branches, sorted, and the current one's name ("detached at <sha>" when none is current).
 * @param {Repo} repo @param {string | null} on
 * @returns {Promise<{ branches: Branch[], head: string }>}
 */
export async function loadBranches(repo, on) {
  const r = await git(repo.top, [...READ, "for-each-ref", `--format=${REF_FORMAT}`, "refs/heads", "refs/remotes"], on);
  const branches = r.ok ? parseBranches(r.out) : [];
  const current = branches.find((b) => b.current);
  if (current) return { branches, head: current.name };
  const sha = await git(repo.top, ["rev-parse", "--short", "HEAD"], on);
  return { branches, head: sha.ok && sha.out ? `detached at ${sha.out}` : "" };
}

/** The newest commits of the current branch. Empty when the repo has none. @param {Repo} repo @param {string | null} on @returns {Promise<Commit[]>} */
export async function loadLog(repo, on) {
  const r = await git(repo.top, [...READ, "log", "-n", "30", `--format=${LOG_FORMAT}`], on);
  return r.ok ? parseLog(r.out) : [];
}

/**
 * One row's diff: the staged change for a staged row, the unstaged change otherwise. A file
 * git does not know yet is read whole. `note` says why there is nothing to draw.
 * @param {Repo} repo @param {string | null} on @param {FileEntry} file
 * @returns {Promise<{ diff: Diff | null, note: string }>}
 */
export async function loadDiff(repo, on, file) {
  if (file.untracked) {
    const text = await readTextFile(`${repo.top}/${file.path}`, { on }).catch(() => /** @type {string | null} */ (null));
    if (text === null) return { diff: null, note: "Cannot preview this file (binary, too large, or unreadable)" };
    if (text.includes("\0")) return { diff: null, note: "Binary file" };
    return { diff: newFileDiff(text), note: "" };
  }
  const r = await git(repo.top, [...READ, PLAIN_PATHS, "diff", ...(file.staged ? ["--cached"] : []), "--no-ext-diff", "--no-textconv", "--no-color", "--no-renames", "--", file.path], on, { raw: true });
  if (!r.ok) return { diff: null, note: r.err || "git could not read this diff" };
  const diff = parseDiff(r.out);
  if (!diff.hunks.length) return { diff: null, note: file.binary ? "Binary file changed" : "No text changes to show" };
  return { diff, note: "" };
}

/** Puts a file's changes in the staging area, a deletion too. @param {Repo} repo @param {string | null} on @param {string} path */
export function stage(repo, on, path) {
  return git(repo.top, [PLAIN_PATHS, "add", "-A", "--", path], on);
}

/** Takes a file back out of the staging area. Its changes stay in the folder. @param {Repo} repo @param {string | null} on @param {string} path */
export function unstage(repo, on, path) {
  return git(repo.top, [PLAIN_PATHS, "reset", "-q", "--", path], on);
}

/** Stages every change. @param {Repo} repo @param {string | null} on */
export function stageAll(repo, on) {
  return git(repo.top, ["add", "-A"], on);
}

/** Empties the staging area. The changes stay in the folder. @param {Repo} repo @param {string | null} on */
export function unstageAll(repo, on) {
  return git(repo.top, ["reset", "-q"], on);
}

/**
 * Throws away a file's unstaged changes. A file git does not know yet is deleted. This cannot be undone.
 * @param {Repo} repo @param {string | null} on @param {FileEntry} file
 */
export function discard(repo, on, file) {
  return git(repo.top, file.untracked ? [PLAIN_PATHS, "clean", "-f", "--", file.path] : [PLAIN_PATHS, "restore", "--worktree", "--", file.path], on);
}

let patches = 0; // numbers each patch file

/**
 * Stages one hunk, or with `reverse` takes one staged hunk back out. The patch goes through a
 * file, since exec cannot feed git's input. This computer only.
 * @param {Repo} repo @param {string} patch from hunkPatch @param {boolean} reverse
 * @returns {Promise<GitResult>}
 */
export async function applyHunk(repo, patch, reverse) {
  const dir = `${appHome()}/data/git-good`.replace(/\\/g, "/");
  const file = `${dir}/${Date.now()}-${++patches}.patch`;
  try {
    await fs.mkdir(dir, { recursive: true });
    await writeTextFile(file, patch, null);
  } catch (e) {
    return { ok: false, out: "", err: `Could not write the patch: ${e instanceof Error ? e.message : String(e)}` };
  }
  const r = await git(repo.top, ["apply", "--cached", "--whitespace=nowarn", ...(reverse ? ["--reverse"] : []), file], null);
  await fs.unlink(file).catch(() => {});
  return r;
}

/** Commits the staged changes. `amend` replaces the last commit. @param {Repo} repo @param {string | null} on @param {string} message @param {boolean} amend */
export function commit(repo, on, message, amend) {
  return git(repo.top, ["commit", ...(amend ? ["--amend"] : []), "-m", message], on, { timeout: SLOW_MS });
}

/** The last commit's whole message, "" when there is none. @param {Repo} repo @param {string | null} on */
export async function lastMessage(repo, on) {
  const r = await git(repo.top, ["log", "-1", "--format=%B"], on);
  return r.ok ? r.out : "";
}

/** Pulls the current branch, fast-forward only: a pull that would need a merge fails and changes nothing. @param {Repo} repo @param {string | null} on */
export function pull(repo, on) {
  return git(repo.top, ["pull", "--ff-only"], on, { timeout: SLOW_MS });
}

/**
 * Pushes a local branch, never forced. With an upstream it goes to that remote branch. Without
 * one it goes to a branch of the same name on "origin" (else the first remote), which becomes
 * its upstream. Both sides are full ref names, so git reads no part of a name as an option.
 * @param {Repo} repo @param {string | null} on @param {Branch} branch a local branch
 * @returns {Promise<GitResult & { remote: string }>} `remote` is the remote pushed to, "" when nothing ran
 */
export async function push(repo, on, branch) {
  const listed = await git(repo.top, ["remote"], on);
  const all = listed.ok ? listed.out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  /** @param {string} err */
  const refuse = (err) => ({ ok: false, out: "", err, remote: "" });
  if (!all.length) return refuse("This repo has no remote to push to");
  const from = `refs/heads/${branch.name}`;
  if (!branch.upstream) {
    const remote = all.includes("origin") ? "origin" : all[0];
    return { ...await git(repo.top, ["push", "-u", remote, from], on, { timeout: SLOW_MS }), remote };
  }
  // The upstream is "<remote>/<branch>". A remote's name can hold a slash, so the longest remote that fits wins.
  const remote = all.filter((r) => branch.upstream.startsWith(`${r}/`)).sort((a, b) => b.length - a.length)[0];
  if (!remote) return refuse(`The upstream ${branch.upstream} is not on a remote`);
  const to = `refs/heads/${branch.upstream.slice(remote.length + 1)}`;
  return { ...await git(repo.top, ["push", remote, `${from}:${to}`], on, { timeout: SLOW_MS }), remote };
}

/** Switches to a local branch. Git carries uncommitted changes over or refuses. @param {Repo} repo @param {string | null} on @param {string} name */
export function switchTo(repo, on, name) {
  return git(repo.top, ["switch", name], on);
}

/** Makes a local branch that tracks a remote branch and switches to it. @param {Repo} repo @param {string | null} on @param {string} remoteName such as "origin/feature/x" */
export function trackBranch(repo, on, remoteName) {
  return git(repo.top, ["switch", "--track", remoteName], on);
}

/** Creates a branch and switches to it. @param {Repo} repo @param {string | null} on @param {string} name @param {string} from the branch or commit it starts at */
export function createBranch(repo, on, name, from) {
  return git(repo.top, ["switch", "-c", name, from], on);
}

/** Puts every uncommitted change aside in a new stash entry, untracked files too. @param {Repo} repo @param {string | null} on */
export function stash(repo, on) {
  return git(repo.top, ["stash", "push", "--include-untracked"], on);
}

/** Brings the newest stash entry back and drops it. On a conflict git keeps the entry. @param {Repo} repo @param {string | null} on */
export function stashPop(repo, on) {
  return git(repo.top, ["stash", "pop"], on);
}
