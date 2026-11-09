// The git worktree a fix runs in: a second folder on the PR's commit, so the agent's
// edits never touch your own checkout. Pushing sends the fix to the PR's branch.
import { appHome, exec } from "herdr";
import * as fs from "fs/promises";
import { git } from "./git.js";
import { commentKey } from "./comments.js";

/** The local branch the worktree uses. Its own name, so the PR branch can stay checked out elsewhere. */
export function fixBranch(pr) { return `tourist/fix-pr-${pr.number}`; }

export function worktreePath(root, pr) {
  return `${appHome()}/data/tourist/worktrees/${commentKey(root, pr.number)}`.replace(/\\/g, "/");
}

/** The worktree for this PR, created on the PR's head commit. One left by an earlier fix is reused as it is. */
export async function openWorktree(root, on, pr) {
  const path = worktreePath(root, pr);
  const list = (await git(["worktree", "list", "--porcelain"], { cwd: root, on })) ?? "";
  if (list.split("\n").some(l => l.toLowerCase() === `worktree ${path}`.toLowerCase())) return path;
  await fs.mkdir(path.replace(/\/[^/]+$/, ""), { recursive: true });
  const made = await git(["worktree", "add", "-B", fixBranch(pr), path, pr.headOid], { cwd: root, on });
  if (made === null) throw new Error(`Could not create a worktree at ${path}.`);
  return path;
}

/** Everything the fix changed against the PR's commit, new files included. */
export async function worktreeDiff(path, on) {
  await git(["add", "--intent-to-add", "--all"], { cwd: path, on });
  return (await git(["diff", "--no-color", "HEAD"], { cwd: path, on })) ?? "";
}

/** Commits the fix in the worktree and pushes it to the PR's branch on origin. */
export async function pushFix(path, on, pr, message) {
  const run = async args => {
    const r = await exec("git", args, { cwd: path, on });
    if (r.code !== 0) throw new Error((r.stderr || r.stdout || `git ${args[0]} failed.`).trim().slice(-500));
  };
  await run(["add", "--all"]);
  await run(["commit", "-q", "-m", message]);
  await run(["push", "origin", `HEAD:refs/heads/${pr.head}`]);
}

/** Deletes the worktree and its local branch. Unpushed edits in it are lost. */
export async function removeWorktree(root, on, pr) {
  await git(["worktree", "remove", "--force", worktreePath(root, pr)], { cwd: root, on });
  await git(["branch", "-D", fixBranch(pr)], { cwd: root, on });
}
