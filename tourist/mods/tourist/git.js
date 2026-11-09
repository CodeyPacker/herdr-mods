// Finding the folder to tour and reading facts about its git repo.
import { spaces, panes, focused, exec } from "herdr";

/** The folder of the pane the tour was opened from, else the space's folder. */
export function startFolder() {
  const f = focused(), space = spaces().find(s => s.active), all = panes();
  const mine = f?.pane ? all.find(p => p.pane === f.pane) : null;
  const sibling = mine ? all.find(p => p.tab === mine.tab && p.cwd) : null;
  return { cwd: mine?.cwd || sibling?.cwd || f?.cwd || space?.folder || null, on: space?.machine ?? null };
}

/** Runs git and returns trimmed stdout, or null on failure. */
export async function git(args, { cwd, on }) {
  try {
    const r = await exec("git", args, { cwd: cwd ?? undefined, on });
    return r.code === 0 ? r.stdout.trim() : null;
  } catch { return null; }
}

/**
 * The repo around `cwd`: root, branch, last commit, base branch, merge base and the
 * files changed since the merge base (uncommitted edits included). Null outside a repo.
 */
export async function readRepo(cwd, on) {
  const root = await git(["rev-parse", "--show-toplevel"], { cwd, on });
  if (!root) return null;
  const run = args => git(args, { cwd: root, on });
  const repo = { root, branch: "", head: "", base: null, mergeBase: null, changed: [] };
  repo.branch = (await run(["branch", "--show-current"])) || "detached HEAD";
  repo.head = (await run(["log", "-1", "--format=%h %s"])) || "";
  let base = await run(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (!base) for (const b of ["main", "master"]) if (await run(["rev-parse", "--verify", "--quiet", b])) { base = b; break; }
  repo.base = base;
  if (base) {
    repo.mergeBase = await run(["merge-base", "HEAD", base]);
    const files = repo.mergeBase ? await run(["diff", "--name-only", repo.mergeBase]) : null;
    repo.changed = files ? files.split("\n").filter(Boolean) : [];
  }
  return repo;
}
