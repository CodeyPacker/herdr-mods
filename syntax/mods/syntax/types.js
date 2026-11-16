/**
 * @typedef {{ ready: boolean, detail: string }} SetupRequirement
 * @typedef {{ node: SetupRequirement, language: SetupRequirement, editor: SetupRequirement }} SetupRequirements
 * @typedef {{ completed: boolean, languageId: string, enabled: string[] }} SetupStatus
 * @typedef {{ id: string, title: string, prompt: string, solution: string,
 *   hints: string[], declarations?: string }} Exercise
 * @typedef {Exercise & { topicId: string }} CatalogExercise
 * @typedef {{ id: string, title: string, description: string, exercises: Exercise[], level?: "advanced" }} Topic
 * @typedef {{ attempts: number, passes: number, independentPasses: number }} Progress
 * @typedef {{ passed: boolean, kind: string, title: string, details: string[],
 *   at?: number, sourceHash?: string, assisted?: boolean }} CheckResult
 * @typedef {{ version: number, languageId: string, exerciseId: string, hintCount: number, answerShown: boolean,
 *   progress: Record<string, Progress>, result: CheckResult | null,
 *   file: string, folder: string, root: string, runtimeVersion: string, stale: boolean, sourceHash: string }} Session
 */
export {};
