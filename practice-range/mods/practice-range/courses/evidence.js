// Module evidence combines course exercises with linked practice drills. Pure functions: no files.
import { restingTime } from "../review.js";

/**
 * @typedef {{ attempts: number, passes: number, independentPasses: number, hinted?: boolean,
 *   last?: number, review?: { streak: number, at: number } }} DrillProgress
 * @typedef {{ progress: Record<string, DrillProgress>, currentTopic: string | null, error?: string }} Drills
 * @typedef {"skipped" | "demonstrated" | "independent-once" | "practiced" | "read" | "started" | "new"} ModuleStatus
 */

/** A drill counts as independent only when it passed without the answer and was never passed with hints. */
const drillIndependent = (/** @type {DrillProgress} */ entry) => entry.independentPasses > 0 && !entry.hinted;

/**
 * Skipping and reading never count as skill. Demonstrated means independent passes on two different
 * exercises or drills, or one independent pass confirmed by a clean later review.
 * Imported answers with unknown assistance never count, because they are recorded as assisted.
 * @param {any} pack @param {any} state @param {Drills} drills
 */
export function moduleEvidence(pack, state, drills) {
  /** @type {Record<string, { status: ModuleStatus, independent: number, practiced: number, reviewed: boolean }>} */
  const result = {};
  for (const lesson of pack.lessons) {
    /** @type {any[]} */
    const tasks = lesson.tasks.map((/** @type {any} */ task) => state.tasks[task.id]).filter((/** @type {any} */ progress) => progress?.attempts);
    /** @type {DrillProgress[]} */
    const linked = (lesson.drills ?? []).map((/** @type {string} */ id) => drills.progress[id]).filter((/** @type {DrillProgress | undefined} */ entry) => entry?.attempts);
    const independent = tasks.filter(progress => progress.independentPasses > 0).length + linked.filter(drillIndependent).length;
    const reviewed = tasks.some(progress => progress.review?.streak > 0) || linked.some(entry => (entry.review?.streak ?? 0) > 0);
    const practiced = tasks.length + linked.length;
    const module = state.modules[lesson.id], seen = module?.seen?.length ?? 0;
    /** @type {ModuleStatus} */
    let status = "new";
    if (independent >= 2 || (independent >= 1 && reviewed)) status = "demonstrated";
    else if (module?.skipped) status = "skipped";
    else if (independent === 1) status = "independent-once";
    else if (practiced) status = "practiced";
    else if (seen && seen >= lesson.steps.length) status = "read";
    else if (seen) status = "started";
    result[lesson.id] = { status, independent, practiced, reviewed };
  }
  return result;
}

export const statusLabels = {
  skipped: "Skipped", demonstrated: "Shown independently", "independent-once": "Passed once without help",
  practiced: "Practiced with help", read: "Read", started: "Started", new: "Not started",
};

/**
 * Linked drills due under Practice review's own rules. Practice review leaves out the topic
 * the practice session is on, so those are left out here too.
 * @param {any} pack @param {Drills} drills @param {number} now
 */
export function dueDrills(pack, drills, now) {
  const due = new Set();
  for (const lesson of pack.lessons) for (const id of lesson.drills ?? []) {
    const entry = drills.progress[id];
    if (!entry?.attempts || id.split("/")[0] === drills.currentTopic) continue;
    if (now - (entry.review?.at ?? entry.last ?? 0) >= restingTime(entry)) due.add(id);
  }
  return [...due].sort();
}
