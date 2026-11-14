// Reading git's branch list: parse, sort and filter. No imports, so plain node can load this file.

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
 * @property {string} worktree the folder that has this branch checked out, "" when none
 * @property {string} subject the last commit's first line
 */

/** The `--format` for `git for-each-ref`. Git writes the unit separator (\x1f) for each %1f, and one ref per line. */
export const REF_FORMAT = "%(refname)%1f%(HEAD)%1f%(upstream:short)%1f%(upstream:track)%1f%(committerdate:unix)%1f%(worktreepath)%1f%(contents:subject)";

const LOCAL = "refs/heads/";
const REMOTE = "refs/remotes/";

/**
 * Parses the output of `git for-each-ref --format=<REF_FORMAT> refs/heads refs/remotes`.
 * Skips empty lines, a remote's default-branch pointer ("origin/HEAD") and anything that is not a branch.
 * @param {string} text
 * @returns {Branch[]}
 */
export function parseBranches(text) {
  /** @type {Branch[]} */
  const out = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [ref = "", head = "", upstream = "", track = "", date = "", worktree = "", ...rest] = line.split("\x1f");
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
      worktree,
      // A subject could hold the separator itself: everything after the sixth one is the subject.
      subject: rest.join("\x1f"),
    });
  }
  return out;
}

/**
 * Local before remote. Inside each group the current branch first, then the newest commit first.
 * @param {Branch[]} branches
 * @returns {Branch[]} a new array
 */
export function sortBranches(branches) {
  return [...branches].sort((a, b) =>
    Number(a.kind === "remote") - Number(b.kind === "remote")
    || Number(b.current) - Number(a.current)
    || b.at - a.at
    || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Keeps the branches whose name contains every word of `text`, ignoring case. Empty text keeps all.
 * @param {Branch[]} branches
 * @param {string} text words split on spaces
 * @returns {Branch[]} a new array
 */
export function filterBranches(branches, text) {
  const words = String(text ?? "").toLowerCase().split(" ").filter(Boolean);
  return branches.filter((b) => {
    const name = b.name.toLowerCase();
    return words.every((w) => name.includes(w));
  });
}
