// A PR review's plan, saved per PR head commit and depth so reopening the same review
// skips the agent's 60-90 second planning. A new push changes the head, so it plans again.
import { appHome, readTextFile, writeTextFile } from "herdr";
import * as fs from "fs/promises";
import { commentKey } from "./comments.js";

const dir = () => `${appHome()}/data/tourist/plans`.replace(/\\/g, "/");
const fileFor = (root, pr, depth) => `${dir()}/${commentKey(root, pr.number)}-${pr.headOid.slice(0, 12)}-${depth}.json`;

/** `{ plan, agent, session, saved }`, or null when this PR head has no saved review at this depth. */
export async function loadSavedPlan(root, pr, depth) {
  try {
    const s = JSON.parse((await readTextFile(fileFor(root, pr, depth))) ?? "null");
    return s && Array.isArray(s.plan?.stops) ? s : null;
  } catch { return null; }
}

/** Saves the plan with its answers so far, and the agent session that made it so follow-ups keep its context. */
export async function savePlan(root, pr, depth, plan, agent, session) {
  await fs.mkdir(dir(), { recursive: true });
  await writeTextFile(fileFor(root, pr, depth), JSON.stringify({ plan, agent, session, saved: new Date().toISOString() }), null);
}

export async function dropSavedPlan(root, pr, depth) {
  await fs.unlink(fileFor(root, pr, depth)).catch(() => {});
}
