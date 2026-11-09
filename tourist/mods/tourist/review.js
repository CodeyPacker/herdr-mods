// Posting your line comments to GitHub as one review on the PR.
import { appHome, writeTextFile } from "herdr";
import * as fs from "fs/promises";
import { gh } from "./pr.js";

export const EVENTS = [
  { key: "1", id: "COMMENT", label: "Comment", hint: "feedback without a verdict" },
  { key: "2", id: "APPROVE", label: "Approve", hint: "the PR can merge" },
  { key: "3", id: "REQUEST_CHANGES", label: "Request changes", hint: "it needs work before merging" },
];

/** GitHub refuses an approval or a change request from the PR's own author, so they only get Comment. */
export function eventsFor(pr) { return pr.mine ? EVENTS.slice(0, 1) : EVENTS; }

// GitHub needs a body for Comment and Request changes. This is used when the summary is left empty.
export const DEFAULT_SUMMARY = "See the inline comments.";

/** GitHub's name for a diff side: RIGHT is the PR's version, LEFT the base's (removed lines). */
const ghSide = side => side === "old" ? "LEFT" : "RIGHT";

/**
 * Posts every comment as one review on the commit the tour reviewed. GitHub only takes
 * lines inside the diff's hunks, which is where Tourist lets you comment. Returns the review's URL.
 */
export async function postReview(root, on, pr, comments, event, summary) {
  const review = {
    commit_id: pr.headOid, event, body: summary.trim() || (event === "APPROVE" ? "" : DEFAULT_SUMMARY),
    comments: comments.map(c => ({
      path: c.file, line: c.line, side: ghSide(c.side), body: c.text,
      // A multi-line comment also names its first line.
      ...(c.startLine !== undefined ? { start_line: c.startLine, start_side: ghSide(c.startSide ?? c.side) } : {}),
    })),
  };
  const dir = `${appHome()}/data/tourist`.replace(/\\/g, "/");
  await fs.mkdir(dir, { recursive: true });
  const file = `${dir}/review-${Date.now()}.json`;
  await writeTextFile(file, JSON.stringify(review), null);
  try {
    const out = await gh(["api", `repos/${pr.repo}/pulls/${pr.number}/reviews`, "-X", "POST", "--input", file], { cwd: root, on });
    return JSON.parse(out).html_url ?? pr.url;
  } finally { await fs.unlink(file).catch(() => {}); }
}
