// Review picks exercises from topics you've already practiced and asks for them again from a
// blank file. Pure functions: the runner owns files and sessions.

const day = 24 * 60 * 60 * 1000;
export const reviewSize = 8;
const perTopic = 3;

/**
 * @typedef {{ attempts: number, passes: number, independentPasses: number, hinted?: boolean,
 *   last?: number, review?: { streak: number, at: number } }} ReviewProgress
 */

/**
 * An exercise needed help when it was never passed, only passed after the answer was shown,
 * failed at least twice, or passed with hints.
 * @param {ReviewProgress} progress
 */
export function neededHelp(progress) {
  return progress.passes === 0 || progress.independentPasses === 0 || progress.attempts - progress.passes >= 2 || Boolean(progress.hinted);
}

/**
 * How long an exercise rests before it's ready again. A clean review doubles the wait
 * (1, 2, 4, 8... days). Exercises never reviewed wait a day if they needed help, three if not.
 * @param {ReviewProgress} progress
 */
export function restingTime(progress) {
  if (progress.review) return day * 2 ** Math.min(progress.review.streak, 6);
  return neededHelp(progress) ? day : 3 * day;
}

/**
 * Exercises ready for review, most useful first: from practiced topics other than the current
 * one, those that needed help before the rest, then the longest unseen.
 * @param {{ topics: { id: string, exercises: { id: string }[] }[] }} catalog
 * @param {Record<string, ReviewProgress>} progress @param {string} currentTopicId @param {number} now
 * @returns {{ id: string, topicId: string, weak: boolean, seen: number }[]}
 */
export function readyForReview(catalog, progress, currentTopicId, now) {
  const ready = [];
  for (const topic of catalog.topics) {
    if (topic.id === currentTopicId) continue;
    for (const exercise of topic.exercises) {
      const id = `${topic.id}/${exercise.id}`;
      const entry = progress[id];
      if (!entry?.attempts) continue;
      // Sessions from before review have no dates; treat them as long unseen.
      const seen = entry.review?.at ?? entry.last ?? 0;
      if (now - seen < restingTime(entry)) continue;
      ready.push({ id, topicId: topic.id, weak: !entry.review && neededHelp(entry) || (entry.review?.streak === 0), seen });
    }
  }
  return ready.sort((a, b) => Number(b.weak) - Number(a.weak) || a.seen - b.seen || a.id.localeCompare(b.id));
}

/**
 * One review set: up to eight ready exercises, no more than three from one topic, in an
 * order that alternates topics so it reads like a recap.
 * @param {ReturnType<typeof readyForReview>} ready
 */
export function reviewSet(ready) {
  /** @type {Map<string, string[]>} */
  const byTopic = new Map();
  let total = 0;
  for (const item of ready) {
    const chosen = byTopic.get(item.topicId) ?? [];
    if (chosen.length >= perTopic || total >= reviewSize) continue;
    chosen.push(item.id);
    byTopic.set(item.topicId, chosen);
    total++;
  }
  const set = [];
  for (let round = 0; set.length < total; round++) {
    for (const ids of byTopic.values()) if (ids[round]) set.push(ids[round]);
  }
  return set;
}
