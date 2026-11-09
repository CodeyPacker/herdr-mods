// Pull requests through the GitHub CLI: listing the open ones, and fetching one so
// git can diff it without checking it out.
import { exec } from "herdr";
import { git } from "./git.js";

const LIST_FIELDS = "number,title,author,headRefName,baseRefName,additions,deletions,changedFiles,isDraft";
const VIEW_FIELDS = "number,title,body,url,author,headRefName,baseRefName,headRefOid,files,commits";

/** Runs gh and returns stdout. Throws gh's own message when it fails. */
async function gh(args, { cwd, on }) {
  let r;
  try { r = await exec("gh", args, { cwd, on }); }
  catch { throw new Error("Pull request tours need the GitHub CLI (gh) on PATH."); }
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || "gh failed.").trim().slice(-400));
  return r.stdout;
}

/** The repo's open pull requests, newest first. */
export async function listPRs(root, on) {
  return JSON.parse(await gh(["pr", "list", "--state", "open", "--limit", "50", "--json", LIST_FIELDS], { cwd: root, on }));
}

/**
 * One pull request, with its commits fetched into `refs/tourist/pr-<n>` and the
 * point where it left its base branch. Nothing is checked out.
 */
export async function loadPR(root, on, number) {
  const p = JSON.parse(await gh(["pr", "view", String(number), "--json", VIEW_FIELDS], { cwd: root, on }));
  const run = args => git(args, { cwd: root, on });
  const fetched = await run(["fetch", "--quiet", "origin", `+refs/pull/${p.number}/head:refs/tourist/pr-${p.number}`, p.baseRefName]);
  if (fetched === null) throw new Error(`Could not fetch PR #${p.number} from origin.`);
  const mergeBase = await run(["merge-base", `refs/remotes/origin/${p.baseRefName}`, p.headRefOid]);
  if (!mergeBase) throw new Error(`Could not find where PR #${p.number} left ${p.baseRefName}.`);
  return {
    number: p.number, title: p.title, body: p.body ?? "", url: p.url, author: p.author?.login ?? "",
    head: p.headRefName, base: p.baseRefName, headOid: p.headRefOid, mergeBase,
    files: (p.files ?? []).map(f => f.path),
    commits: (p.commits ?? []).map(c => c.messageHeadline),
  };
}

/** The unified diff of one file in the PR, or null when git can't produce it. */
export function prFileDiff(root, on, pr, file) {
  return git(["diff", "--no-color", "--unified=3", pr.mergeBase, pr.headOid, "--", file], { cwd: root, on });
}
