// Practice files and runs: the learner's exercise file, the composed file next to it, and running it
// with the language's tool. Every function takes the course's slug, so courses never share files.
import { exec, readTextFile, writeTextFile, window } from "herdr";
import * as fs from "fs/promises";
import { dataDir } from "./course.js";

export const RUN_TIMEOUT = 60000;

/** The folder the learner's file is in. Watched while the exercise is shown. */
export const workDir = (slug, id) => `${dataDir()}/work/${slug}/${id}`;
export const workFile = (slug, id, lang) => `${workDir(slug, id)}/${lang.practice.file}`;
// Each copy of the mod runs its own file, so two copies showing one exercise never clash.
const copy = Math.random().toString(36).slice(2, 8);
/** The composed file's name. Outside work/ so writing it never wakes the watch. */
const runName = (id, tag) => `${id}.${tag}.${copy}`;
const runDir = () => `${dataDir()}/run`;

/** Writes the starter unless the learner's file is already there. */
export async function ensureWork(slug, ex, lang) {
  await fs.mkdir(workDir(slug, ex.id), { recursive: true });
  // Two copies of the mod may both write it at once. Both write the same starter, so that is fine.
  if (!(await fs.exists(workFile(slug, ex.id, lang)))) await fs.writeFile(workFile(slug, ex.id, lang), ex.starter);
}

/** Puts the starter back in the learner's file. */
export async function resetWork(slug, ex, lang) {
  await fs.mkdir(workDir(slug, ex.id), { recursive: true });
  const path = workFile(slug, ex.id, lang);
  await writeTextFile(path, ex.starter, await readTextFile(path).catch(() => null));
}

/** Where the Neovim that Tutor opens for an exercise listens for remote commands. */
export function editorPipe(slug, id) {
  return window()?.platform === "windows" ? `\\\\.\\pipe\\tutor-${slug}-${id}` : `${runDir()}/${slug}-${id}.nvim.sock`;
}

/**
 * Makes that Neovim load the file again, dropping unsaved edits (reset was confirmed).
 * Does nothing when no Neovim is listening.
 */
export async function reloadEditor(slug, id) {
  await exec("nvim", ["--headless", "--server", editorPipe(slug, id), "--remote-send", "<C-\\><C-N>:e!<CR>"], { timeout: 5000 }).catch(() => {});
}

/** The learner's file as it is now. */
export const readWork = (slug, id, lang) => readTextFile(workFile(slug, id, lang)).then(t => t ?? "").catch(() => "");

/** True when the language's run tool (dotnet for C#) can start. */
export async function haveTool(lang) {
  const r = await exec(lang.practice.tool, ["--version"], { timeout: 20000 }).catch(() => null);
  return r?.code === 0;
}

/**
 * Composes `source` with the exercise and runs it. Returns the language's parseRun result.
 * `tag` keeps runs of the same exercise for different reasons apart. A run that hits the timeout
 * also stops the program it built.
 */
export async function runSource(ex, source, lang, tag) {
  const p = lang.practice, name = runName(ex.id, tag);
  await fs.mkdir(runDir(), { recursive: true });
  const path = `${runDir()}/${name}.${p.file.split(".").pop()}`;
  await fs.writeFile(path, p.compose(ex, source));
  const { exe, args } = p.command(path);
  const started = Date.now();
  let r;
  try { r = await exec(exe, args, { timeout: RUN_TIMEOUT }); }
  catch (e) {
    if (Date.now() - started < RUN_TIMEOUT - 1000) throw new Error(`Could not run ${exe}: ${e?.message ?? e}`);
    r = { code: 1, stdout: "", stderr: "" };
  }
  const timedOut = Date.now() - started >= RUN_TIMEOUT - 1000;
  if (timedOut) {
    const stop = p.stop(name, window()?.platform === "windows");
    await exec(stop.exe, stop.args).catch(() => {});
  }
  return p.parseRun(ex, { ...r, timedOut });
}

/**
 * Runs the learner's file. Returns the result plus `source`, the text that was run.
 * Copies of the mod can share this module: runs of one exercise go one after another.
 */
export function runExercise(slug, ex, lang) {
  const key = `${slug}/${ex.id}`;
  const p = (chains.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const source = await readWork(slug, ex.id, lang);
    return { ...(await runSource(ex, source, lang, "work")), source };
  });
  chains.set(key, p);
  return p;
}
const chains = new Map();
