// Merging your own PR from the end of a review. GitHub won't let you approve your own PR,
// so this is the step that finishes one.
import { gh } from "./pr.js";

const METHODS = [
  { id: "squash", setting: "allow_squash_merge", label: "Squash and merge", hint: "one commit on the base branch" },
  { id: "merge", setting: "allow_merge_commit", label: "Create a merge commit", hint: "keeps every commit, plus a merge commit" },
  { id: "rebase", setting: "allow_rebase_merge", label: "Rebase and merge", hint: "replays each commit onto the base branch" },
];

/** The merge methods the repo allows, in GitHub's order. Key 1 to 3 picks one. */
export async function mergeMethods(root, on, pr) {
  const out = await gh(["api", `repos/${pr.repo}`, "--jq", "{allow_squash_merge, allow_merge_commit, allow_rebase_merge}"], { cwd: root, on });
  const allowed = JSON.parse(out);
  const list = METHODS.filter(m => allowed[m.setting] !== false);
  if (list.length === 0) throw new Error(`${pr.repo} allows no merge method.`);
  return list.map((m, i) => ({ ...m, key: String(i + 1) }));
}

/**
 * Merges the PR with the picked method, only if its head is still the commit the tour
 * reviewed. Branch deletion is left to the repo's own setting, and nothing local is touched.
 * Throws GitHub's reason when the merge is blocked (checks, required reviews, conflicts).
 */
export async function mergePR(root, on, pr, method) {
  try { await gh(["pr", "merge", String(pr.number), "-R", pr.repo, `--${method}`, "--match-head-commit", pr.headOid], { cwd: root, on }); }
  catch (e) {
    // Someone pushed since the tour started: say so, rather than GitHub's terse refusal.
    if (/head branch was modified|match-head-commit|expected head sha/i.test(String(e?.message ?? e)))
      throw new Error(`the PR has commits newer than ${pr.headOid.slice(0, 7)}, the one this tour reviewed. Press q and open the PR again to review them before merging.`);
    throw e;
  }
}
