// Setup lives beside practice data, so reopening the tutorial never resets answers.
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { runProcess } from "./process.mjs";
import { defaultLanguage, findLanguage, languages } from "./languages/index.js";
import { loadLanguageRunner } from "./languages/runner.mjs";

/**
 * setup.json version 2 records which bundled packs finished setup and which one is active.
 * Version 1 files only described C#, so they read as C# enabled and active.
 * @returns {Promise<{ completed: boolean, languageId: string, enabled: string[] }>}
 */
export async function setupStatus(root) {
  let saved;
  try { saved = JSON.parse(await readFile(join(root, "setup.json"), "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return { completed: false, languageId: defaultLanguage.id, enabled: [] };
    throw new Error(`Cannot read setup.json: ${error.message}`);
  }
  const known = new Set(languages.map(language => language.id));
  const enabled = saved.version === 1 ? (saved.completed === true && saved.languageId === defaultLanguage.id ? [defaultLanguage.id] : [])
    : saved.version === 2 && Array.isArray(saved.enabled) ? saved.enabled.filter(id => known.has(id)) : [];
  const languageId = enabled.includes(saved.languageId) ? saved.languageId : enabled[0] ?? defaultLanguage.id;
  return { completed: enabled.length > 0, languageId, enabled };
}

async function writeSetup(root, languageId, enabled) {
  const temporary = join(root, `setup-${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify({ version: 2, languageId, enabled }, null, 2) + "\n");
  await rename(temporary, join(root, "setup.json"));
}

/** @param {string | null} editor @param {{ languageId?: string, run?: typeof runProcess, runtime?: { environment(): Promise<{ version: string }> } }} [options] */
export async function checkRequirements(editor, { languageId = defaultLanguage.id, run = runProcess, runtime } = {}) {
  const pack = findLanguage(languageId);
  const runner = runtime ?? await loadLanguageRunner(pack.id);
  const node = { ready: Number(process.versions.node.split(".")[0]) >= 20, detail: `Node.js ${process.versions.node} (20 or newer required)` };
  let language;
  try { const version = await runner.environment(); language = { ready: true, detail: `${pack.name}: ${version.version}` }; }
  catch (error) { language = { ready: false, detail: error.message }; }
  let editorCheck = { ready: false, detail: "Choose Neovim or VS Code, then check its command." };
  if (editor) {
    if (editor !== "neovim" && editor !== "vscode") throw new Error("Choose Neovim or VS Code.");
    const command = editor === "neovim" ? "nvim" : "code";
    try {
      const result = await run(command, ["--version"], { timeout: 10000 });
      editorCheck = { ready: result.code === 0 && !result.problem, detail: result.code === 0 && !result.problem ? `${command} is available` : `${command} is not available. ${result.problem || result.stderr}` };
    } catch { editorCheck = { ready: false, detail: `The ${command} command is not available. Install or enable it, then recheck.` }; }
  }
  return { node, language, editor: editorCheck };
}

/** Enable a pack after its checks pass and make it the active language. */
export async function completeSetup(root, editor, languageId = defaultLanguage.id, options = {}) {
  const pack = findLanguage(languageId);
  const requirements = await checkRequirements(editor, { ...options, languageId: pack.id });
  if (![requirements.node, requirements.language, requirements.editor].every(item => item.ready)) throw new Error("Finish the requirement and editor checks before starting practice.");
  const status = await setupStatus(root);
  await writeSetup(root, pack.id, [...new Set([...status.enabled, pack.id])]);
  return { completed: true, languageId: pack.id, enabled: [...new Set([...status.enabled, pack.id])] };
}

/** Switch between packs that already finished setup. Practice data is not touched. */
export async function selectLanguage(root, languageId) {
  const pack = findLanguage(languageId);
  const status = await setupStatus(root);
  if (!status.enabled.includes(pack.id)) throw new Error(`Set up ${pack.name} before switching to it.`);
  await writeSetup(root, pack.id, status.enabled);
  return { ...status, languageId: pack.id };
}
