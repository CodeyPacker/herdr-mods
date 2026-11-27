/**
 * @typedef {{ id: string, title?: string, languageId?: string, contentVersion?: string,
 *   preview?: boolean, available?: number, total?: number, error?: string, enrolledVersion?: string, versions?: string[], reading?: boolean, done?: number }} CourseSummary
 * @typedef {{ kind: string, title: string, text: string, example?: string, examples?: string[],
 *   questions?: string[], task?: string, tasks?: string[] }} Step
 * @typedef {{ id: string, prompt: string, choices: {text: string, feedback: string}[], answer: number }} Question
 * @typedef {{ id: string, title: string, prompt: string, role: string, feedback: string,
 *   hints: string[], hintTotal?: number, solution: string | null, fixtures: {id: string, declarations: string}[],
 *   workspace?: {editable: {file: string, solution: string | null}[]}, generated?: boolean }} Task
 * @typedef {{ id: string, title: string, intro: string, steps: Step[], questions: Question[],
 *   examples: Record<string, {code: string, readOnly?: boolean, fence?: string, stdout?: string[], diagnostics?: {code: number, line: number}[]}>,
 *   tasks: Task[], extraTasks?: Task[], drills?: string[] }} Lesson
 * @typedef {{ id: string, title: string, status: string }} Module
 * @typedef {{ choice: number, correct: boolean, attempts: number, at: number }} QuestionProgress
 * @typedef {{ passed: boolean, title: string, details: string[], assisted: boolean }} CourseResult
 * @typedef {{ attempts: number, passes: number, independentPasses: number, hintCount: number,
 *   answerShown: boolean, result?: CourseResult }} TaskProgress
 * @typedef {{ course: { id: string, title: string, languageId: string, contentVersion: string, preview: boolean,
 *   modules: Module[], lessons: Lesson[], codeFence?: string, reading?: boolean,
 *   readiness?: {id: string, title: string, modules: string[], task: Task}[], project?: {id: string, title: string, checkpoints: {id: string, title: string, module: string, taskId: string | null}[]} | null },
 *   enrollment: { position: {moduleId: string, step: number} | null,
 *   activeTask: string | null, entryPath?: string, review?: {ids: string[], index: number}, modules: Record<string, { seen: number[], skipped?: boolean, questions: Record<string, QuestionProgress>, examples?: Record<string, CourseResult> }>,
 *   tasks: Record<string, TaskProgress> }, file: string | null, folder: string | null, sourceHash: string | null,
 *   stale: boolean, pendingSave?: boolean, reviewReady: number,
 *   attachment?: {name?: string, commit?: string, available: boolean, detail?: string},
 *   repoLessons?: {error?: string, lessons: RepoLesson[]},
 *   profile?: LearningProfile,
 *   recommendation: {kind: string, reason: string, moduleId?: string, taskId?: string, step?: number, count?: number},
 *   evidence?: Record<string, {status: import("./evidence.js").ModuleStatus, independent: number, practiced: number, reviewed: boolean}>, drillError?: string | null, extrasError?: string | null,
 *   update?: {to: string, compatible: boolean, started: boolean, newTasks: number} | null, migration?: {from: string, to: string, retiredTasks: string[]} | null }} CourseSnapshot
 * @typedef {{id: string, target: string, title: string, name: string, commit: string, scope: string,
 *   sections: {title: string, text: string, references: {path: string, start: number, end: number, code: string}[]}[]}} RepoLesson
 * @typedef {{path: string, commit: string, start: number, end: number, total: number | null, code: string,
 *   referenceStart: number, referenceEnd: number, previous: number | null, next: number | null, detail?: string}} RepoSource
 * @typedef {{configured: boolean, knownLanguages: string[], error?: string}} LearningProfile
 */
export {};
