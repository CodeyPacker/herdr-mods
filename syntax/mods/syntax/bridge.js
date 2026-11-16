import { appHome, exec, props, readTextFile, writeTextFile } from "herdr";
import { parseEditorConfig, saveEditorConfig } from "./editor-config.js";
import { parseTutorConfig, saveTutorConfig } from "./tutor/config.js";

export async function configuredEditor() {
  return parseEditorConfig(await readTextFile(`${appHome()}/syntax.json`));
}

/** @param {"neovim" | "vscode"} editor */
export async function saveEditorPreference(editor) {
  const path = `${appHome()}/syntax.json`;
  await saveEditorConfig(editor, {
    read: () => readTextFile(path),
    write: (text, expected) => writeTextFile(path, text, expected),
  });
}

export function practiceDirectory() {
  // Tests or an explicitly configured panel can use a separate practice directory.
  return props()?.practiceDirectory ?? `${appHome()}/data/syntax`;
}

/** @param {string} action @param {string | null} [value] */
async function runnerCommand(action, value) {
  const result = await exec("node", [`${appHome()}/mods/syntax/runner.mjs`, practiceDirectory(), action, ...(value ? [value] : [])], { timeout: 180000 });
  let data;
  try { data = JSON.parse(result.stdout); }
  catch { throw new Error(result.stderr || result.stdout || "The practice runner did not return a result."); }
  if (result.code !== 0 || data.error) throw new Error(data.error || result.stderr || "The practice action failed.");
  return data;
}

/** @param {string} action @param {string | null} [value] @returns {Promise<import("./types.js").Session>} */
export function practiceCommand(action, value) { return runnerCommand(action, value); }

/** @returns {Promise<import("./types.js").SetupStatus>} */
export function setupStatus() { return runnerCommand("setup-status"); }

/** @param {"neovim" | "vscode" | null} editor @param {string} languageId @returns {Promise<import("./types.js").SetupRequirements>} */
export function checkSetupRequirements(editor, languageId) { return runnerCommand("setup-check", JSON.stringify({ editor, languageId })); }

/** @param {"neovim" | "vscode"} editor @param {string} languageId @returns {Promise<import("./types.js").SetupStatus>} */
export function completeSetup(editor, languageId) { return runnerCommand("setup-complete", JSON.stringify({ editor, languageId })); }

/** @param {string} command @param {Record<string, unknown>} args */
export async function appCommand(command, args) {
  const result = await exec("herdr-app", ["do", command, JSON.stringify(args)]);
  if (result.code !== 0) throw new Error(result.stderr || result.stdout || `${command} failed.`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

/** @param {string} folder @param {string} file */
export async function openVSCode(folder, file) {
  const result = await exec("code", ["--reuse-window", folder, "--goto", file]);
  if (result.code !== 0) throw new Error(result.stderr || "Could not open VS Code. Install its code command or use the displayed file path.");
}

/** @param {string} server @param {string} file */
export async function reuseNeovim(server, file) {
  try {
    const result = await exec("nvim", ["--server", server, "--remote", file]);
    return result.code === 0;
  } catch { return false; }
}

/** @returns {Promise<import("./tutor/config.js").TutorConfig>} */
export async function configuredTutor() {
  return parseTutorConfig(await readTextFile(`${appHome()}/syntax.json`));
}

/** @param {import("./tutor/config.js").TutorProvider | null} provider */
export async function saveTutorPreference(provider) {
  const path = `${appHome()}/syntax.json`;
  await saveTutorConfig(provider, { read: () => readTextFile(path), write: (text, expected) => writeTextFile(path, text, expected) });
}

/** @param {string} action @param {string} value */
async function tutorCommand(action, value) {
  const result = await exec("node", [`${appHome()}/mods/syntax/tutor/service.mjs`, practiceDirectory(), `${appHome()}/syntax.json`, action, value], { timeout: 150000 });
  let data;
  try { data = JSON.parse(result.stdout); } catch { throw new Error("The tutor could not respond. Check your CLI installation and sign-in."); }
  if (result.code !== 0 || data.error) throw new Error(data.error || "The tutor request failed.");
  return data;
}

/** @param {import("./tutor/config.js").TutorProvider} provider */
export function checkTutorProvider(provider) { return tutorCommand("connect", provider); }
/** @param {string} id */
export function cancelTutorRequest(id) { return tutorCommand("cancel", id); }
/** @param {{ id: string, languageId: string, exerciseId: string, question: string, messages: import("./tutor/panel.js").TutorMessage[] }} request @returns {Promise<{reply: string}>} */
export function askTutorQuestion(request) { return tutorCommand("ask", JSON.stringify(request)); }
