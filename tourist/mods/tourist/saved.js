// A tour's plan, saved so reopening the same tour skips the agent's planning. The key
// names what the plan was made from: a PR's head commit, or HEAD for the last commit, the
// whole repo or a feature. When that moves, the key changes and the tour plans again.
// Branch tours aren't saved: they include uncommitted edits, which change all the time.
import { appHome, readTextFile, writeTextFile } from "herdr";
import * as fs from "fs/promises";

const dir = () => `${appHome()}/data/tourist/plans`.replace(/\\/g, "/");
const safe = s => String(s).replace(/[^A-Za-z0-9._-]+/g, "_");

/** A short stable hash, so a feature's text can be part of a file name. */
function hash(text) {
  let h = 5381;
  for (const ch of text) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(16);
}

/**
 * The saved-plan key for a tour, or null for one that isn't saved. `head` is the commit the
 * tour is about: the PR's head for a PR, else the repo's HEAD. PR keys keep the shape they
 * had when only PRs were saved, so those saved plans still load.
 */
export function planKey({ root, scope, depth, head, pr, feature }) {
  if (!head) return null;
  if (scope === "pr") return pr ? `${safe(`${root}#pr-${pr.number}`)}-${head.slice(0, 12)}-${depth}` : null;
  if (scope === "commit" || scope === "repo") return `${safe(root)}-${scope}-${head.slice(0, 12)}-${depth}`;
  if (scope === "feature") return `${safe(root)}-feature-${hash(feature.trim().toLowerCase())}-${head.slice(0, 12)}-${depth}`;
  return null;
}

/** `{ plan, agent, session, saved }`, or null when there's no saved plan for this key. */
export async function loadSavedPlan(key) {
  try {
    const s = JSON.parse((await readTextFile(`${dir()}/${key}.json`)) ?? "null");
    return s && Array.isArray(s.plan?.stops) ? s : null;
  } catch { return null; }
}

/** Saves the plan with its answers so far, and the agent session that made it so follow-ups keep its context. */
export async function savePlan(key, plan, agent, session) {
  await fs.mkdir(dir(), { recursive: true });
  await writeTextFile(`${dir()}/${key}.json`, JSON.stringify({ plan, agent, session, saved: new Date().toISOString() }), null);
}

export async function dropSavedPlan(key) {
  await fs.unlink(`${dir()}/${key}.json`).catch(() => {});
}
