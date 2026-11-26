// Course review uses the same intervals and set size as direct practice.
import { neededHelp, restingTime, reviewSet } from "../review.js";

/** @param {any} progress */
function evidence(progress) {
  const last = progress.history?.at(-1);
  return { attempts: progress.attempts, passes: progress.passes, independentPasses: progress.independentPasses,
    hinted: last?.assisted ?? false, review: progress.review };
}

/** @param {any} pack @param {any} state @param {number} now */
export function courseReview(pack, state, now) {
  const ready = [];
  for (const lesson of pack.lessons) for (const task of lesson.tasks) {
    const progress = state.tasks[task.id];
    if (!progress?.attempts) continue;
    const summary = evidence(progress);
    const seen = progress.review?.at ?? progress.history.at(-1)?.at ?? 0;
    if (now - seen < restingTime(summary)) continue;
    ready.push({ id: task.id, topicId: lesson.id, weak: progress.review ? progress.review.streak === 0 : neededHelp(summary), seen });
  }
  ready.sort((a, b) => Number(b.weak) - Number(a.weak) || a.seen - b.seen || a.id.localeCompare(b.id));
  return { ready, ids: reviewSet(ready) };
}

/** @param {any} pack @param {any} state @param {number} now */
export function nextCourseAction(pack, state, now) {
  if (state.review) return { kind: "review", reason: "Continue your review in fresh files." };
  for (const lesson of pack.lessons) for (const task of lesson.tasks) {
    const progress = state.tasks[task.id], last = progress?.history?.at(-1);
    if (last && (!last.passed || last.assisted)) {
      const variation = lesson.tasks.find(other => other.id !== task.id && !state.tasks[other.id]?.attempts && other.concepts.some(id => task.concepts.includes(id)));
      if (variation) return { kind: "task", moduleId: lesson.id, taskId: variation.id,
        reason: last.passed ? "Try a related task independently after using help." : "Try a related task to work on the concept that failed." };
    }
  }
  if (courseReview(pack, state, now).ids.length) return { kind: "review", reason: "Previously practiced exercises are due for review." };
  for (const entry of pack.modules) {
    const lesson = pack.lessons.find(lesson => lesson.id === entry.id);
    if (!lesson || state.modules[lesson.id]?.skipped) continue;
    const seen = state.modules[lesson.id]?.seen ?? [];
    const step = lesson.steps.findIndex((_step, index) => !seen.includes(index));
    if (step >= 0) return { kind: "lesson", moduleId: lesson.id, step, reason: "Continue with the next unread lesson step." };
  }
  return { kind: "practice", reason: "You have read the course. Continue practicing independently or revisit a module." };
}
