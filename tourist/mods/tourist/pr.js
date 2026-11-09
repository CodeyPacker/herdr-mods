// Pull requests through the GitHub CLI: listing the open ones, and fetching one so
// git can diff it without checking it out.
import { exec } from "herdr";
import { git } from "./git.js";

const LIST_FIELDS = "number,title,author,headRefName,baseRefName,additions,deletions,changedFiles,isDraft";
const VIEW_FIELDS = "number,title,body,url,author,headRefName,baseRefName,headRefOid,files,commits";

/** Runs gh and returns stdout. Throws gh's own message when it fails. */
export async function gh(args, { cwd, on }) {
  let r;
  try { r = await exec("gh", args, { cwd, on }); }
  catch { throw new Error("Pull request tours need the GitHub CLI (gh) on PATH."); }
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || "gh failed.").trim().slice(-400));
  return r.stdout;
}

/**
 * "owner/repo" from origin's URL. gh is given this with -R rather than finding the
 * repo itself, because its own git call doesn't get the folder when Herdr runs it.
 */
export async function repoName(root, on) {
  let r;
  try { r = await exec("git", ["remote", "get-url", "origin"], { cwd: root, on }); }
  catch (e) { throw new Error(`Could not run git in ${root}: ${String(e?.message ?? e)}`); }
  const url = r.code === 0 ? r.stdout.trim() : "";
  if (!url) throw new Error(`Could not read the origin remote in ${root} (git exit ${r.code}): ${(r.stderr || r.stdout || "no output").trim().slice(-300)}`);
  const m = /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(url);
  if (!m) throw new Error(`Pull request tours need a GitHub origin, and origin is ${url}.`);
  return m[1];
}

/** The repo's open pull requests, newest first. */
export async function listPRs(root, on) {
  const repo = await repoName(root, on);
  return JSON.parse(await gh(["pr", "list", "-R", repo, "--state", "open", "--limit", "50", "--json", LIST_FIELDS], { cwd: root, on }));
}

/**
 * One pull request, with its commits fetched into `refs/tourist/pr-<n>` and the
 * point where it left its base branch. Nothing is checked out.
 */
export async function loadPR(root, on, number) {
  const repo = await repoName(root, on);
  const p = JSON.parse(await gh(["pr", "view", String(number), "-R", repo, "--json", VIEW_FIELDS], { cwd: root, on }));
  const run = args => git(args, { cwd: root, on });
  const fetched = await run(["fetch", "--quiet", "origin", `+refs/pull/${p.number}/head:refs/tourist/pr-${p.number}`, p.baseRefName]);
  if (fetched === null) throw new Error(`Could not fetch PR #${p.number} from origin.`);
  const mergeBase = await run(["merge-base", `refs/remotes/origin/${p.baseRefName}`, p.headRefOid]);
  if (!mergeBase) throw new Error(`Could not find where PR #${p.number} left ${p.baseRefName}.`);
  // Yours when gh's signed-in account wrote it. Unknown counts as someone else's, so a fix is never offered by mistake.
  const me = await gh(["api", "user", "--jq", ".login"], { cwd: root, on }).then(s => s.trim(), () => "");
  const author = p.author?.login ?? "";
  return {
    repo, number: p.number, title: p.title, body: p.body ?? "", url: p.url, author,
    me, mine: Boolean(me) && me.toLowerCase() === author.toLowerCase(),
    head: p.headRefName, base: p.baseRefName, headOid: p.headRefOid, mergeBase,
    files: (p.files ?? []).map(f => f.path),
    commits: (p.commits ?? []).map(c => c.messageHeadline),
  };
}

/**
 * The PR's review comment threads on GitHub that still sit on a line of the current
 * diff (outdated ones have no `line`). Each is `{ file, line, side, startLine?, startSide?,
 * comments: [{ author, body, created }] }`, replies in order after the first comment.
 */
export async function listThreads(pr, root, on) {
  const out = await gh(["api", "--paginate", `repos/${pr.repo}/pulls/${pr.number}/comments`,
    "-q", ".[] | {id, in_reply_to_id, path, line, side, start_line, start_side, author: .user.login, body, created: .created_at} | @json"], { cwd: root, on });
  const all = out.split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
  const side = s => s === "LEFT" ? "old" : "new";
  const threads = new Map();
  for (const c of all.filter(c => !c.in_reply_to_id && c.line != null)) {
    threads.set(c.id, {
      file: c.path, line: c.line, side: side(c.side),
      ...(c.start_line != null ? { startLine: c.start_line, startSide: side(c.start_side ?? c.side) } : {}),
      comments: [{ author: c.author, body: c.body, created: c.created }],
    });
  }
  for (const c of all.filter(c => c.in_reply_to_id)) threads.get(c.in_reply_to_id)?.comments.push({ author: c.author, body: c.body, created: c.created });
  for (const t of threads.values()) t.comments.sort((a, b) => a.created.localeCompare(b.created));
  return [...threads.values()];
}

/** The unified diff of one file in the PR, or null when git can't produce it. */
export function prFileDiff(root, on, pr, file) {
  return git(["diff", "--no-color", "--unified=3", pr.mergeBase, pr.headOid, "--", file], { cwd: root, on });
}
