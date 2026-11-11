// Re-reviewing a PR: the commit you last reviewed, and what changed in the PR's files since.
// A head counts as reviewed when you posted a review on it (from Tourist or on GitHub) or
// marked every file of its tour viewed. The newest of those wins.
import { appHome, readTextFile, writeTextFile } from "herdr";
import * as fs from "fs/promises";
import { gh, repoName } from "./pr.js";
import { git } from "./git.js";

const dir = () => `${appHome()}/data/tourist/reviewed`.replace(/\\/g, "/");

/** Remembers that you reviewed the PR at `head`. `key` is the PR's commentKey. */
export async function saveReviewed(key, head) {
  await fs.mkdir(dir(), { recursive: true });
  const path = `${dir()}/${key}.json`;
  await writeTextFile(path, JSON.stringify({ head, at: new Date().toISOString() }), await readTextFile(path));
}

async function localReviewed(key) {
  try {
    const r = JSON.parse((await readTextFile(`${dir()}/${key}.json`)) ?? "null");
    return r?.head ? { oid: r.head, at: r.at ?? "" } : null;
  } catch { return null; }
}

/** Your newest submitted review on GitHub: `{ oid, at }`, or null. */
async function githubReviewed(root, on, number) {
  const repo = await repoName(root, on);
  const [me, out] = await Promise.all([
    gh(["api", "user", "--jq", ".login"], { cwd: root, on }).then(s => s.trim().toLowerCase()),
    gh(["api", "--paginate", `repos/${repo}/pulls/${number}/reviews`,
      "-q", ".[] | {login: .user.login, oid: .commit_id, at: .submitted_at, state} | @json"], { cwd: root, on }),
  ]);
  const mine = out.split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l))
    .filter(r => r.login?.toLowerCase() === me && r.state !== "PENDING" && r.oid && r.at);
  mine.sort((a, b) => b.at.localeCompare(a.at));
  return mine[0] ? { oid: mine[0].oid, at: mine[0].at } : null;
}

/**
 * The commit you last reviewed this PR at, `{ oid, at }`, or null when you haven't reviewed it
 * or nothing was pushed since. `key` is the PR's commentKey, `head` its current head.
 */
export async function lastReviewed(root, on, key, number, head) {
  const [local, remote] = await Promise.all([localReviewed(key), githubReviewed(root, on, number).catch(() => null)]);
  const last = [local, remote].filter(Boolean).sort((a, b) => b.at.localeCompare(a.at))[0];
  return last && last.oid !== head ? last : null;
}

/** Makes sure the old commit is in the local repo, fetching it from origin if needed. False when it can't. */
export async function haveCommit(root, on, oid) {
  const has = () => git(["cat-file", "-e", `${oid}^{commit}`], { cwd: root, on }).then(r => r !== null);
  if (await has()) return true;
  await git(["fetch", "--quiet", "origin", oid], { cwd: root, on });
  return has();
}

/**
 * What changed between `oid` and the PR's head, in the PR's own files only (a merge of the
 * base branch also changes other files). `{ files, commits }`; commits leave out the base's.
 */
export async function changesSince(root, on, pr, oid) {
  const run = args => git(args, { cwd: root, on });
  const [files, commits] = await Promise.all([
    run(["diff", "--name-only", "--no-renames", oid, pr.headOid, "--", ...pr.files]),
    run(["log", "--no-merges", "--format=%s", `${oid}..${pr.headOid}`, "--not", `refs/remotes/origin/${pr.base}`]),
  ]);
  return {
    files: String(files ?? "").split(/\r?\n/).filter(Boolean),
    commits: String(commits ?? "").split(/\r?\n/).filter(Boolean),
  };
}

/** "3 hours ago", "2 days ago". */
export function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(s)) return "";
  const [n, unit] = s < 3600 ? [Math.max(1, Math.round(s / 60)), "minute"] : s < 86400 ? [Math.round(s / 3600), "hour"] : [Math.round(s / 86400), "day"];
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}
