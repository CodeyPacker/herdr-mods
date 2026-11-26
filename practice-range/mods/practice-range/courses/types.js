/**
 * @typedef {{ id: string, title?: string, languageId?: string, contentVersion?: string,
 *   preview?: boolean, imported?: boolean, available?: number, total?: number, error?: string, enrolledVersion?: string, versions?: string[] }} CourseSummary
 * @typedef {{ kind: string, title: string, text: string, example?: string, examples?: string[],
 *   questions?: string[], task?: string, tasks?: string[] }} Step
 * @typedef {{ id: string, prompt: string, choices: {text: string, feedback: string}[], answer: number }} Question
 * @typedef {{ id: string, title: string, prompt: string, role: string, feedback: string,
 *   hints: string[], hintTotal?: number, solution: string | null, fixtures: {id: string, declarations: string}[],
 *   workspace?: {editable: {file: string, solution: string | null}[]}, generated?: boolean }} Task
 * @typedef {{ id: string, title: string, intro: string, steps: Step[], questions: Question[],
 *   examples: Record<string, {code: string, readOnly?: boolean, sourceError?: string, repoRef?: {path: string, start: number, end: number, commit: string}, stdout?: string[], diagnostics?: {code: number, line: number}[]}>,
 *   tasks: Task[], drills?: string[], generated?: {source: string, baseVersion: string, commit: string, scope: string} }} Lesson
 * @typedef {{ id: string, title: string, status: string, part?: string, generated?: boolean, generatedExercises?: boolean }} Module
 * @typedef {{ choice: number, correct: boolean, attempts: number, at: number }} QuestionProgress
 * @typedef {{ passed: boolean, title: string, details: string[], assisted: boolean, assistanceUnknown?: boolean }} CourseResult
 * @typedef {{ attempts: number, passes: number, independentPasses: number, hintCount: number,
 *   answerShown: boolean, assistanceUnknown?: boolean, legacy?: {passed?: boolean, runs?: number, hints?: number, gaveUp?: boolean}, result?: CourseResult }} TaskProgress
 * @typedef {{ course: { id: string, title: string, languageId: string, contentVersion: string, preview: boolean,
 *   modules: Module[], lessons: Lesson[], codeFence?: string,
 *   legacy?: {source: string, known: string[], parts: {id: string,title: string}[]} }, enrollment: { position: {moduleId: string, step: number} | null,
 *   activeTask: string | null, review?: {ids: string[], index: number}, modules: Record<string, { seen: number[], resumeStep?: number, skipped?: boolean, questions: Record<string, QuestionProgress>, examples?: Record<string, CourseResult> }>,
 *   tasks: Record<string, TaskProgress>, legacy?: {modules: Record<string,{doneAt?: string,quiz?: {best?: number,passed?: boolean}}>} }, file: string | null, folder: string | null, sourceHash: string | null,
 *   stale: boolean, pendingSave?: boolean, reviewReady: number,
 *   attachment?: {name?: string, commit?: string, available: boolean, detail?: string},
 *   repoLessons?: {error?: string, lessons: RepoLesson[]},
 *   profile?: LearningProfile,
 *   recommendation: {kind: string, reason: string, moduleId?: string, taskId?: string, step?: number, count?: number},
 *   evidence?: Record<string, {status: import("./evidence.js").ModuleStatus, independent: number, practiced: number, reviewed: boolean}>, drillError?: string | null }} CourseSnapshot
 * @typedef {{slug: string,title: string,error?: string,courseId?: string,contentVersion?: string,fingerprint?: string,
 *   languageId?: string,modules?: number,written?: number,questions?: number,exercises?: number,answers?: number,
 *   orphanAnswers?: number,warnings?: string[],known?: string[],alreadyImported?: boolean,
 *   preferences?: {editor?: string,agent?: string}}} TutorImport
 * @typedef {{id: string, target: string, title: string, name: string, commit: string, scope: string,
 *   sections: {title: string, text: string, references: {path: string, start: number, end: number, code: string}[]}[]}} RepoLesson
 * @typedef {{path: string, commit: string, start: number, end: number, total: number | null, code: string,
 *   referenceStart: number, referenceEnd: number, previous: number | null, next: number | null, detail?: string}} RepoSource
 * @typedef {{configured: boolean, knownLanguages: string[], error?: string}} LearningProfile
 */
export {};
