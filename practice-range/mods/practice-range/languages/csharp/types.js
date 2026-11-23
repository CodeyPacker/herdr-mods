/**
 * @typedef {{ kind: string, message: string, name?: string, type?: string,
 *   modifier?: string, token?: string, min?: number }} SyntaxRule
 *
 * @typedef {{ id: string, title: string, prompt: string, solution: string,
 *   checks: string[], rules: SyntaxRule[], hints: string[], starter?: string,
 *   mode?: "body" | "members" | "types", declarations?: string, support?: string }} Exercise
 *
 * @typedef {{ id: string, title: string, description: string, exercises: Exercise[], level?: "advanced" }} Topic
 * @typedef {Exercise & { topicId: string }} CatalogExercise
 */
export {};
