/**
 * A syntax rule matches nodes of the learner's answer. `kind` is a TypeScript SyntaxKind name.
 * `name` is the declared, called, or referenced name. `type` compares a type annotation.
 * `has` requires a node property such as questionDotToken or initializer. `anyOf` accepts
 * equivalent forms. `min` and `max` bound how many nodes match.
 * @typedef {{ message: string, kind?: string, name?: string, type?: string, operator?: string,
 *   modifier?: string, declaration?: "const" | "let" | "var", has?: string, text?: string,
 *   within?: string, min?: number, max?: number, anyOf?: Omit<SyntaxRule, "message">[] }} SyntaxRule
 *
 * `checks` are runtime boolean expressions. `typeChecks` are types that must be `true`.
 * `rejects` are single statements that must be type errors. Script exercises share scope with
 * the answer. Module exercises import the answer as `answer`.
 * @typedef {{ id: string, title: string, prompt: string, solution: string, hints: string[],
 *   rules: SyntaxRule[], checks?: string[], typeChecks?: string[], rejects?: string[],
 *   declarations?: string, modules?: Record<string, string>, mode?: "script" | "module", starter?: string }} Exercise
 *
 * @typedef {{ id: string, title: string, description: string, exercises: Exercise[], level?: "advanced" }} Topic
 * @typedef {Exercise & { topicId: string, starter: string }} CatalogExercise
 */
export {};
