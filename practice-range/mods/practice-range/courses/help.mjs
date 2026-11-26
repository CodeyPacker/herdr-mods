// Only current lesson material and the saved answer enter a question. Trusted checks stay local.
import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { courseCommand, enrollmentDirectory } from "./service.mjs";
import { repositoryContext } from "./repo.mjs";

export async function askCourseTutor(root, configPath, request, options = {}) {
  const { askTutor } = await import("../tutor/service.mjs");
  const result = await askTutor(root, configPath, request, { ...options, buildContext: courseTutorContext });
  if (request.taskId) await courseCommand(root, "ai-help", request);
  return result;
}

export async function courseTutorContext(root, request) {
  if (typeof request.question !== "string" || !request.question.trim() || request.question.length > 4000) throw new Error("Ask a question of 1–4,000 characters.");
  const messages = request.messages ?? [];
  if (!Array.isArray(messages) || messages.length > 12 || messages.some(message => !message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string" || message.content.length > 16000)) throw new Error("This conversation is too long. Start a new chat.");
  const state = await courseCommand(root, "status", request);
  const position = state.enrollment.position;
  if (!request.taskId && (!position || position.moduleId !== request.moduleId || position.step !== request.step)) throw new Error("The lesson changed. Ask again from the current step.");
  const lesson = state.course.lessons.find(lesson => lesson.id === request.moduleId);
  const step = lesson?.steps[request.step];
  if (!step) throw new Error("Unknown lesson step.");
  const context = { language: state.course.languageId, course: state.course.title, entryPath: state.enrollment.entryPath,
    knownLanguages: state.profile.knownLanguages,
    lesson: { title: lesson.title, step: step.title, explanation: step.text },
    examples: [...(step.examples ?? []), ...(step.example ? [step.example] : [])].map(id => lesson.examples[id]),
    repository: await repositoryContext(enrollmentDirectory(root, state.course)),
    conversation: messages, question: request.question.trim() };
  if (request.taskId) {
    if (state.enrollment.activeTask !== request.taskId) throw new Error("The exercise changed. Ask again from the current exercise.");
    const task = lesson.tasks.find(task => task.id === request.taskId);
    if (!task) throw new Error("This exercise does not belong to the current lesson.");
    const files = {};
    const editable = task.workspace?.editable.map(file => file.file) ?? [state.file.split(/[\\/]/).at(-1)];
    let size = 0;
    for (const file of editable) {
      const path = join(state.folder, file);
      size += (await stat(path)).size;
      if (size > 128000) throw new Error("The saved answer is too large for the tutor.");
      files[file] = await readFile(path, "utf8");
    }
    context.exercise = { title: task.title, prompt: task.prompt, suppliedTypes: task.fixtures, hints: task.hints };
    context.savedAnswer = files;
    context.feedback = state.enrollment.tasks[task.id].result ?? null;
    context.revealedAnswer = task.workspace ? task.workspace.editable.filter(file => file.solution).map(file => ({ file: file.file, source: file.solution })) : task.solution;
  }
  return context;
}
