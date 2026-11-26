/**
 * @typedef {{ id: string, title?: string, languageId?: string, contentVersion?: string,
 *   preview?: boolean, available?: number, total?: number, error?: string }} CourseSummary
 * @typedef {{ kind: string, title: string, text: string, example?: string, examples?: string[],
 *   questions?: string[], task?: string, tasks?: string[] }} Step
 * @typedef {{ id: string, prompt: string, choices: {text: string, feedback: string}[], answer: number }} Question
 * @typedef {{ id: string, title: string, prompt: string, role: string, feedback: string,
 *   hints: string[], solution: string | null, fixtures: {id: string, declarations: string}[] }} Task
 * @typedef {{ id: string, title: string, intro: string, steps: Step[], questions: Question[],
 *   examples: Record<string, {code: string, stdout?: string[], diagnostics?: {code: number, line: number}[]}>,
 *   tasks: Task[] }} Lesson
 * @typedef {{ id: string, title: string, status: string }} Module
 * @typedef {{ choice: number, correct: boolean, attempts: number, at: number }} QuestionProgress
 * @typedef {{ passed: boolean, title: string, details: string[], assisted: boolean }} CourseResult
 * @typedef {{ attempts: number, passes: number, independentPasses: number, hintCount: number,
 *   answerShown: boolean, result?: CourseResult }} TaskProgress
 * @typedef {{ course: { id: string, title: string, languageId: string, contentVersion: string, preview: boolean,
 *   modules: Module[], lessons: Lesson[] }, enrollment: { position: {moduleId: string, step: number} | null,
 *   activeTask: string | null, modules: Record<string, { seen: number[], questions: Record<string, QuestionProgress> }>,
 *   tasks: Record<string, TaskProgress> }, file: string | null, folder: string | null, sourceHash: string | null,
 *   stale: boolean, pendingSave?: boolean }} CourseSnapshot
 */
export {};
