import { mkdir, mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseTutorConfig } from "./config.js";
import { checkProvider, requestReply } from "./providers.mjs";
import { findLanguage } from "../languages/index.js";
import { catalogFor } from "../catalog.js";
import { languageRoot, exerciseFile } from "../runner.mjs";

async function settings(path) {
  try { return parseTutorConfig(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return parseTutorConfig(null); throw error; }
}

function cancelFile(root, id) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error("Invalid tutor request ID.");
  return join(root, "tutor-jobs", `${id}.cancel`);
}

export async function cancelRequest(root, id) {
  const file = cancelFile(root, id);
  await mkdir(join(root, "tutor-jobs"), { recursive: true });
  await writeFile(file, "cancelled\n");
  return { cancelled: true };
}

export async function tutorContext(root, request) {
  if (typeof request.question !== "string" || !request.question.trim() || request.question.length > 4000) throw new Error("Ask a question of 1–4,000 characters.");
  const messages = request.messages ?? [];
  if (!Array.isArray(messages) || messages.length > 12 || messages.some(message => !message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string" || message.content.length > 16000)) throw new Error("This conversation is too long. Start a new chat.");
  const language = findLanguage(request.languageId);
  const exercise = catalogFor(language).findExercise(request.exerciseId);
  const base = languageRoot(root, language);
  const file = exerciseFile(base, exercise.id, language);
  if ((await stat(file)).size > 128000) throw new Error("The saved answer is too large for the tutor.");
  const answer = await readFile(file, "utf8");
  let session = null;
  try { session = JSON.parse(await readFile(join(base, "session.json"), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const current = session?.exerciseId === exercise.id;
  return { language: language.name, exercise: { title: exercise.title, prompt: exercise.prompt, suppliedTypes: exercise.declarations ?? null }, savedAnswer: answer,
    feedback: current ? session.result : null, revealedAnswer: current && session.answerShown ? exercise.solution : null,
    conversation: messages, question: request.question.trim() };
}

export async function askTutor(root, configPath, request, { run, pollMs = 150, buildContext = tutorContext } = {}) {
  const config = await settings(configPath);
  if (!config.enabled || !config.provider) throw new Error("The AI tutor is off. Enable it in Setup to ask a question.");
  const cancelled = cancelFile(root, request.id);
  const controller = new AbortController();
  const inspect = async () => {
    try {
      const latest = await settings(configPath);
      const stopped = await stat(cancelled).then(() => true, () => false);
      if (!latest.enabled || latest.provider !== config.provider || stopped) controller.abort();
    } catch { controller.abort(); }
  };
  await inspect();
  if (controller.signal.aborted) throw new Error("Tutor request cancelled.");
  const context = await buildContext(root, request);
  const directory = await mkdtemp(join(tmpdir(), "syntax-tutor-"));
  let timer;
  const monitor = async () => { await inspect(); if (!controller.signal.aborted) timer = setTimeout(monitor, pollMs); };
  try {
    await inspect();
    if (controller.signal.aborted) throw new Error("Tutor request cancelled.");
    timer = setTimeout(monitor, pollMs);
    const reply = await requestReply(config.provider, JSON.stringify(context), directory, controller.signal, run);
    await inspect();
    if (controller.signal.aborted) throw new Error("Tutor request cancelled.");
    return { reply };
  } finally {
    clearTimeout(timer);
    controller.abort();
    await rm(directory, { recursive: true, force: true });
    await rm(cancelled, { force: true });
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [root, configPath, action, value] = process.argv.slice(2);
  try {
    let result;
    if (action === "connect") result = await checkProvider(value);
    else if (action === "cancel") result = await cancelRequest(root, value);
    else if (action === "ask") result = await askTutor(root, configPath, JSON.parse(value));
    else if (action === "ask-course") {
      const { askCourseTutor } = await import("../courses/help.mjs");
      result = await askCourseTutor(root, configPath, JSON.parse(value));
    }
    else throw new Error("Unknown tutor action.");
    console.log(JSON.stringify(result));
  } catch (error) { console.log(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}
