import { defaultLanguage } from "./languages/index.js";

/** @param {import("./languages/types.js").LanguagePack} language */
export function catalogFor(language) {
  const { topics, exercises } = language;
  /** @param {string} id */
  function findExercise(id) {
    const exercise = exercises.find(item => item.id === id);
    if (!exercise) throw new Error(`Unknown exercise: ${id}`);
    return exercise;
  }
  /** @param {string} topicId */
  function topicExercises(topicId) {
    return exercises.filter(exercise => exercise.topicId === topicId);
  }
  return { topics, exercises, findExercise, topicExercises };
}

export const defaultCatalog = catalogFor(defaultLanguage);
export const { topics, exercises, findExercise, topicExercises } = defaultCatalog;
