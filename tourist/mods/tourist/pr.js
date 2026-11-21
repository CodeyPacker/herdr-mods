// Pull requests through the GitHub CLI: listing the open ones, and fetching one so
// git can diff it without checking it out.
import { exec, appHome } from "herdr";
import { git } from "./git.js";

const LIST_FIELDS = "number,title,author,headRefName,headRefOid,baseRefName,additions,deletions,changedFiles,isDraft";
const VIEW_FIELDS = "number,title,body,url,author,headRefName,baseRefName,headRefOid,files,commits";

/**
 * Runs gh and resolves with its exit code and output. On this computer it goes through gh.mjs,
 * which uses the signed-in account that owns the repo (see its top comment). Without node, or on
 * another machine, gh runs as its active account. Rejects when gh cannot start.
 */
export async function execGh(args, { cwd, on }) {
  if (!on) {
    try { return await exec("node", [`${appHome().replace(/\\/g, "/")}/mods/tourist/gh.mjs`, ...args], { cwd }); } catch {}
  }
  return exec("gh", args, { cwd, on });
}

/** Runs gh and returns stdout. Throws gh's own message when it fails. */
export async function gh(args, { cwd, on }) {
  let r;
  try { r = await execGh(args, { cwd, on }); }
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

// Each review thread's GraphQL id and state, keyed by its first comment's REST id. Resolving
// a thread is GraphQL only. Up to 100 threads a page, every page.
const THREADS_QUERY = `query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) { pullRequest(number: $number) {
    reviewThreads(first: 100, after: $endCursor) { pageInfo { hasNextPage endCursor }
      nodes { id isResolved viewerCanReply viewerCanResolve viewerCanUnresolve comments(first: 1) { nodes { databaseId } } } } } } }`;

async function threadStates(pr, root, on) {
  const [owner, name] = pr.repo.split("/");
  const out = await gh(["api", "graphql", "--paginate", "-f", `query=${THREADS_QUERY}`, "-F", `owner=${owner}`, "-F", `name=${name}`, "-F", `number=${pr.number}`,
    "-q", ".data.repository.pullRequest.reviewThreads.nodes[] | @json"], { cwd: root, on });
  const states = new Map();
  for (const l of out.split(/\r?\n/).filter(Boolean)) {
    const n = JSON.parse(l), first = n.comments?.nodes?.[0]?.databaseId;
    if (first) states.set(first, { nodeId: n.id, resolved: n.isResolved, canReply: n.viewerCanReply, canResolve: n.viewerCanResolve, canUnresolve: n.viewerCanUnresolve });
  }
  return states;
}

/**
 * The PR's review comment threads on GitHub that still sit on a line of the current
 * diff (outdated ones have no `line`). Each is `{ id, file, line, side, startLine?, startSide?,
 * comments: [{ author, body, created }] }`, replies in order after the first comment. `id` is the
 * first comment's id, which replies go to. When GraphQL answers, each also has `nodeId`,
 * `resolved`, `canReply`, `canResolve` and `canUnresolve`.
 */
export async function listThreads(pr, root, on) {
  const [out, states] = await Promise.all([
    gh(["api", "--paginate", `repos/${pr.repo}/pulls/${pr.number}/comments`,
      "-q", ".[] | {id, in_reply_to_id, path, line, side, start_line, start_side, author: .user.login, body, created: .created_at} | @json"], { cwd: root, on }),
    threadStates(pr, root, on).catch(() => new Map()),
  ]);
  const all = out.split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
  const side = s => s === "LEFT" ? "old" : "new";
  const threads = new Map();
  for (const c of all.filter(c => !c.in_reply_to_id && c.line != null)) {
    threads.set(c.id, {
      id: c.id, file: c.path, line: c.line, side: side(c.side),
      ...(c.start_line != null ? { startLine: c.start_line, startSide: side(c.start_side ?? c.side) } : {}),
      ...(states.get(c.id) ?? {}),
      comments: [{ author: c.author, body: c.body, created: c.created }],
    });
  }
  for (const c of all.filter(c => c.in_reply_to_id)) threads.get(c.in_reply_to_id)?.comments.push({ author: c.author, body: c.body, created: c.created });
  for (const t of threads.values()) t.comments.sort((a, b) => a.created.localeCompare(b.created));
  return [...threads.values()];
}

/** Posts a reply at the end of a thread, as the signed-in gh account. */
export async function replyToThread(pr, root, on, thread, body) {
  await gh(["api", `repos/${pr.repo}/pulls/${pr.number}/comments/${thread.id}/replies`, "-X", "POST", "-f", `body=${body}`], { cwd: root, on });
}

/** Resolves a thread, or unresolves it when `resolved` is false. */
export async function setThreadResolved(root, on, thread, resolved) {
  const name = resolved ? "resolveReviewThread" : "unresolveReviewThread";
  await gh(["api", "graphql", "-f", `query=mutation($id: ID!) { ${name}(input: {threadId: $id}) { thread { isResolved } } }`, "-f", `id=${thread.nodeId}`], { cwd: root, on });
}

/**
 * Every file the PR changes: `{ file, status, add, del }`. status is git's letter (M, A, D, ...).
 * add and del are null for binary files. Renames count as a delete and an add, like the diffs.
 */
export async function prFileStats(root, on, pr) {
  // A re-review lists only the PR's files that changed since the last review.
  const paths = pr.sinceOid ? ["--", ...pr.files] : [];
  const run = args => git(["diff", "--no-renames", ...args, fromOf(pr), pr.headOid, ...paths], { cwd: root, on });
  const [status, numstat] = await Promise.all([run(["--name-status"]), run(["--numstat"])]);
  const counts = new Map();
  for (const line of String(numstat ?? "").split(/\r?\n/).filter(Boolean)) {
    const [add, del, ...path] = line.split("\t");
    counts.set(path.join("\t"), { add: add === "-" ? null : +add, del: del === "-" ? null : +del });
  }
  return String(status ?? "").split(/\r?\n/).filter(Boolean).map(line => {
    const [letter, ...path] = line.split("\t"), file = path.join("\t");
    return { file, status: letter[0], ...(counts.get(file) ?? { add: null, del: null }) };
  });
}

/** Where the tour's diffs start: the commit last reviewed on a re-review, else the merge base. */
export function fromOf(pr) { return pr.sinceOid ?? pr.mergeBase; }

/**
 * The unified diff of one file in the tour, or null when git can't produce it. `whole` asks for
 * the whole PR's change even on a re-review.
 */
export function prFileDiff(root, on, pr, file, whole = false) {
  return git(["diff", "--no-color", "--unified=3", whole ? pr.mergeBase : fromOf(pr), pr.headOid, "--", file], { cwd: root, on });
}
