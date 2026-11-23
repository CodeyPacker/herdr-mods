/**
 * A syntax rule matches tokens of the learner's answer, ignoring comments and string literals.
 * `has` is a token pattern such as "LEFT JOIN" or "COUNT ( DISTINCT". `...` inside a pattern
 * matches any tokens within the same statement, as in "CASE ... END". `anyOf` accepts
 * equivalent forms. `min` and `max` bound how many times it appears; `max: 0` forbids it.
 * @typedef {{ message: string, has?: string, anyOf?: string[], min?: number, max?: number }} SyntaxRule
 *
 * Checks restore the practice dataset (plus `setup`) twice: once for `solution`, once for the
 * answer. By default the last result each returns must match. With `verify`, that query runs
 * after both and its results must match instead (set `result: true` to compare both).
 * `ordered` makes row order part of the result. `rejects` are statements that must fail
 * after the answer runs, such as inserts a new constraint should block.
 * @typedef {{ id: string, title: string, prompt: string, solution: string, hints: string[],
 *   rules: SyntaxRule[], tables: string[], setup?: string, verify?: string, result?: boolean,
 *   ordered?: boolean, rejects?: string[], starter?: string }} Exercise
 *
 * @typedef {{ id: string, title: string, description: string, exercises: Exercise[], level?: "advanced" }} Topic
 * @typedef {Exercise & { topicId: string, starter: string, declarations: string }} CatalogExercise
 */
export {};
