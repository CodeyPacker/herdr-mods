// Runs git through the app and reads a repo's branches. Arguments always go to exec as
// separate array items, never as a shell string.
import { exec } from "herdr";
import { REF_FORMAT, parseBranches, sortBranches } from "./parse.js";

/** @typedef {import("./parse.js").Branch} Branch */
/** @typedef {{ ok: boolean, out: string, err: string }} GitResult `err` is git's message: stderr, or stdout when stderr is empty */
/** @typedef {{ top: string, name: string }} Repo `top` is the repo's top folder, `name` is its last part */

/**
 * Runs git in a folder. Never throws: a git that cannot start (git missing, folder gone,
 * machine unreachable, timeout) comes back as `ok: false` with the error's message.
 * @param {string} cwd
 * @param {string[]} args
 * @param {string | null} [on] a space's machine name, or null for this computer
 * @param {number} [timeout] milliseconds
 * @returns {Promise<GitResult>}
 */
export async function git(cwd, args, on, timeout) {
  try {
    const r = await exec("git", args, { cwd, on: on ?? null, ...(timeout === undefined ? {} : { timeout }) });
    const out = (r.stdout ?? "").trim();
    const err = (r.stderr ?? "").trim();
    return { ok: r.code === 0, out, err: err || out };
  } catch (e) {
    return { ok: false, out: "", err: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * The repo a folder is in, or null when it is not in one.
 * @param {string} folder
 * @param {string | null} [on]
 * @returns {Promise<Repo | null>}
 */
export async function repoOf(folder, on) {
  const r = await git(folder, ["rev-parse", "--show-toplevel"], on);
  if (!r.ok || !r.out) return null;
  const name = r.out.split(/[\\/]/).filter(Boolean).pop() ?? r.out;
  return { top: r.out, name };
}

/**
 * A repo's branches, sorted. `head` is the current branch's name, or "detached at <short sha>"
 * when no branch is current ("" when the repo has no commit yet). `error` is git's message
 * when the listing failed, else "".
 * @param {Repo} repo
 * @param {string | null} [on]
 * @returns {Promise<{ branches: Branch[], head: string, error: string }>}
 */
export async function loadBranches(repo, on) {
  const r = await git(repo.top, ["--no-optional-locks", "for-each-ref", `--format=${REF_FORMAT}`, "refs/heads", "refs/remotes"], on);
  if (!r.ok) return { branches: [], head: "", error: r.err || "git could not list the branches" };
  const branches = sortBranches(parseBranches(r.out));
  const current = branches.find((b) => b.current);
  if (current) return { branches, head: current.name, error: "" };
  const sha = await git(repo.top, ["rev-parse", "--short", "HEAD"], on);
  return { branches, head: sha.ok && sha.out ? `detached at ${sha.out}` : "", error: "" };
}

/**
 * Switches to a branch. Uncommitted changes are left to git: it carries them over or refuses.
 * @param {Repo} repo @param {string | null} on @param {string} name
 * @returns {Promise<GitResult>}
 */
export function switchTo(repo, on, name) {
  return git(repo.top, ["switch", name], on);
}

/**
 * Makes a local branch that tracks a remote branch and switches to it: "origin/feature/x" gives "feature/x".
 * @param {Repo} repo @param {string | null} on @param {string} remoteName such as "origin/feature/x"
 * @returns {Promise<GitResult>}
 */
export function trackBranch(repo, on, remoteName) {
  return git(repo.top, ["switch", "--track", remoteName], on);
}

/** How long a fetch may take, in milliseconds. */
const FETCH_TIMEOUT_MS = 120000;

/**
 * Fetches every remote and drops remote branches that are gone there.
 * @param {Repo} repo @param {string | null} on
 * @returns {Promise<GitResult>}
 */
export function fetchAll(repo, on) {
  return git(repo.top, ["fetch", "--all", "--prune"], on, FETCH_TIMEOUT_MS);
}

/** How long a pull or a push may take, in milliseconds. */
const SYNC_TIMEOUT_MS = 120000;

/**
 * The names of the repo's remotes, in git's order. Empty when it has none or git fails.
 * @param {Repo} repo @param {string | null} on
 * @returns {Promise<string[]>}
 */
export async function remotes(repo, on) {
  const r = await git(repo.top, ["remote"], on);
  return r.ok ? r.out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
}

/**
 * Pulls the current branch from its upstream. Fast-forward only: a pull that would need a
 * merge fails with git's message and changes nothing.
 * @param {Repo} repo @param {string | null} on
 * @returns {Promise<GitResult>}
 */
export function pull(repo, on) {
  return git(repo.top, ["pull", "--ff-only"], on, SYNC_TIMEOUT_MS);
}

/**
 * Pushes a local branch, never forced. With an upstream it goes to that remote branch. Without
 * one it goes to a branch of the same name on "origin" (else the repo's first remote), which
 * becomes its upstream. Both sides are full ref names, so git reads no part of a branch name
 * as an option or a force mark.
 * @param {Repo} repo @param {string | null} on @param {Branch} branch a local branch
 * @returns {Promise<GitResult & { remote: string }>} `remote` is the remote pushed to, "" when nothing ran
 */
export async function push(repo, on, branch) {
  const all = await remotes(repo, on);
  /** @param {string} err */
  const refuse = (err) => ({ ok: false, out: "", err, remote: "" });
  if (!all.length) return refuse("This repo has no remote to push to");
  const from = `refs/heads/${branch.name}`;
  if (!branch.upstream) {
    const remote = all.includes("origin") ? "origin" : all[0];
    return { ...await git(repo.top, ["push", "-u", remote, from], on, SYNC_TIMEOUT_MS), remote };
  }
  // The upstream is "<remote>/<branch>". A remote's name can hold a slash, so the longest remote that fits wins.
  const remote = all.filter((r) => branch.upstream.startsWith(`${r}/`)).sort((a, b) => b.length - a.length)[0];
  if (!remote) return refuse(`The upstream ${branch.upstream} is not on a remote`);
  const to = `refs/heads/${branch.upstream.slice(remote.length + 1)}`;
  return { ...await git(repo.top, ["push", remote, `${from}:${to}`], on, SYNC_TIMEOUT_MS), remote };
}

/**
 * Creates a branch and switches to it.
 * @param {Repo} repo @param {string | null} on @param {string} name
 * @param {string} from the branch or commit the new branch starts at
 * @returns {Promise<GitResult>}
 */
export function createBranch(repo, on, name, from) {
  return git(repo.top, ["switch", "-c", name, from], on);
}

/**
 * Renames a local branch.
 * @param {Repo} repo @param {string | null} on @param {string} oldName @param {string} newName
 * @returns {Promise<GitResult>}
 */
export function renameBranch(repo, on, oldName, newName) {
  return git(repo.top, ["branch", "-m", oldName, newName], on);
}

/**
 * Deletes a local branch. Without `force` git refuses a branch that is not fully merged.
 * @param {Repo} repo @param {string | null} on @param {string} name @param {boolean} [force]
 * @returns {Promise<GitResult>}
 */
export function deleteBranch(repo, on, name, force) {
  return git(repo.top, ["branch", force ? "-D" : "-d", name], on);
}

/** The lines of a git output, without the empty ones. @param {string} out */
function lineCount(out) {
  return out.split(/\r?\n/).filter((l) => l.trim()).length;
}

/**
 * How much uncommitted work the repo holds. `changed` counts the changed and untracked files,
 * `stashes` counts the stash entries. A git that fails counts as 0.
 * @param {Repo} repo @param {string | null} on
 * @returns {Promise<{ changed: number, stashes: number }>}
 */
export async function status(repo, on) {
  const [changed, stashes] = await Promise.all([
    git(repo.top, ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain"], on),
    git(repo.top, ["stash", "list"], on),
  ]);
  return { changed: changed.ok ? lineCount(changed.out) : 0, stashes: stashes.ok ? lineCount(stashes.out) : 0 };
}

/**
 * Puts every uncommitted change aside in a new stash entry, untracked files too.
 * @param {Repo} repo @param {string | null} on
 * @returns {Promise<GitResult>}
 */
export function stash(repo, on) {
  return git(repo.top, ["stash", "push", "--include-untracked"], on);
}

/**
 * Brings the newest stash entry back and drops it. On a conflict or a refusal git keeps the entry.
 * @param {Repo} repo @param {string | null} on
 * @returns {Promise<GitResult>}
 */
export function stashPop(repo, on) {
  return git(repo.top, ["stash", "pop"], on);
}
