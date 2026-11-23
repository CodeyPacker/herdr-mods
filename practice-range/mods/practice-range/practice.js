// Small pure helpers keep progression and hint behavior independent of the UI.
import { defaultCatalog } from "./catalog.js";

/** @param {import("./types.js").Session | null} state @param {string} topicId @param {typeof defaultCatalog} [catalog] */
export function topicProgress(state, topicId, catalog = defaultCatalog) {
  const items = catalog.topicExercises(topicId);
  const counts = items.map(item => state?.progress?.[item.id] ?? { attempts: 0, passes: 0, independentPasses: 0 });
  return {
    practiced: counts.filter(item => item.attempts > 0).length,
    passed: counts.filter(item => item.passes > 0).length,
    attempts: counts.reduce((sum, item) => sum + (item.attempts ?? 0), 0),
    total: items.length,
  };
}

/** @param {string} query @param {typeof defaultCatalog} [catalog] */
export function filteredTopics(query, catalog = defaultCatalog) {
  const search = query.trim().toLowerCase();
  return catalog.topics.filter(topic => !search || `${topic.title} ${topic.description} ${topic.level ?? ""}`.toLowerCase().includes(search)
    || topic.exercises.some(exercise => `${exercise.title} ${exercise.prompt}`.toLowerCase().includes(search)));
}

/** @param {import("./types.js").Exercise} exercise @param {number} count */
export function visibleHints(exercise, count) {
  return exercise.hints.slice(0, Math.max(0, Math.min(exercise.hints.length, count)));
}

/** @param {string} topicId @param {Record<string, string>} recent @param {typeof defaultCatalog} [catalog] */
export function savedExercise(topicId, recent, catalog = defaultCatalog) {
  const items = catalog.topicExercises(topicId);
  return items.find(item => item.id === recent?.[topicId]) ?? items[0];
}
