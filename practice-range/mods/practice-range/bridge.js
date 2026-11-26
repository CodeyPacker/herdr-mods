import { appHome, exec, props, readTextFile, writeTextFile, window as appWindow } from "herdr";
import { parseEditorConfig, parseSyncConfig, saveEditorConfig } from "./editor-config.js";
import { parseTutorConfig, saveTutorConfig } from "./tutor/config.js";
import { parseLayoutConfig, saveLayoutConfig } from "./layout-config.js";
import { neovimCloseDiffsExpression } from "./editor-pane.js";

export async function configuredEditor() {
  return parseEditorConfig(await readTextFile(`${appHome()}/practice-range.json`));
}

/** @param {"neovim" | "vscode"} editor */
export async function saveEditorPreference(editor) {
  const path = `${appHome()}/practice-range.json`;
  await saveEditorConfig(editor, {
    read: () => readTextFile(path),
    write: (text, expected) => writeTextFile(path, text, expected),
  });
}

export function practiceDirectory() {
  // Tests or an explicitly configured panel can use a separate practice directory.
  return props()?.practiceDirectory ?? `${appHome()}/data/practice-range`;
}

/** True when practice-range.json turns on device sync. */
export async function syncEnabled() {
  return parseSyncConfig(await readTextFile(`${appHome()}/practice-range.json`));
}

/** Pull or push progress with git (sync.mjs). Resolves to an error message, or "" on success. @param {"pull" | "push"} action */
export async function syncProgress(action) {
  try {
    const result = await exec("node", [`${appHome()}/mods/practice-range/sync.mjs`, practiceDirectory(), action], { timeout: 90000 });
    let data;
    try { data = JSON.parse(result.stdout); } catch { return result.stderr || "Device sync did not return a result."; }
    return data.error ?? "";
  } catch (error) { return error instanceof Error ? error.message : String(error); }
}

/** @param {string} action @param {string | null} [value] */
async function runnerCommand(action, value) {
  // An install downloads with npm, which can take a few minutes on a slow connection.
  const timeout = action === "setup-install" ? 330000 : 180000;
  const result = await exec("node", [`${appHome()}/mods/practice-range/runner.mjs`, practiceDirectory(), action, ...(value ? [value] : [])], { timeout });
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

/** @param {"neovim" | "vscode"} editor @param {string} languageId @returns {Promise<import("./types.js").SetupStatus>} */
export function completeSetup(editor, languageId) { return runnerCommand("setup-complete", JSON.stringify({ editor, languageId })); }

/**
 * What this computer has: "tools" is Node, the language packs and the editors, "tutors" the AI
 * commands. They are separate because the AI checks are slow.
 * @template {"tools" | "tutors"} P @param {P} part
 * @returns {Promise<P extends "tools" ? import("./types.js").ToolScan : import("./types.js").TutorScan>}
 */
export function scanSetup(part) { return runnerCommand("setup-scan", part); }

/** Install a pack's npm dependencies (setup/install.mjs). @param {string} languageId */
export function installLanguage(languageId) { return runnerCommand("setup-install", languageId); }

/** Open a web page in the default browser. @param {string} url */
export async function openUrl(url) {
  const platform = appWindow()?.platform;
  const result = platform === "windows" ? await exec("rundll32.exe", ["url.dll,FileProtocolHandler", url])
    : await exec(platform === "macos" ? "open" : "xdg-open", [url]);
  if (result.code !== 0) throw new Error(`Could not open ${url}. Open it in your browser.`);
}

/** @returns {Promise<import("./types.js").Layout>} */
export async function configuredLayout() {
  return parseLayoutConfig(await readTextFile(`${appHome()}/practice-range.json`));
}

/** @param {import("./types.js").Layout} layout */
export async function saveLayoutPreference(layout) {
  const path = `${appHome()}/practice-range.json`;
  await saveLayoutConfig(layout, { read: () => readTextFile(path), write: (text, expected) => writeTextFile(path, text, expected) });
}

/** Run app commands one after another. @param {{ command: string, args: Record<string, unknown> }[]} commands */
export async function appCommands(commands) {
  for (const { command, args } of commands) await appCommand(command, args);
}

/** @param {string} command @param {Record<string, unknown>} args */
export async function appCommand(command, args) {
  const result = await exec("herdr-app", ["do", command, JSON.stringify(args)]);
  if (result.code !== 0) {
    // herdr-app reports errors as JSON: { "error": "..." }. Show only the message.
    const text = result.stderr || result.stdout;
    let reason = text;
    try { reason = JSON.parse(text).error ?? text; } catch {}
    throw new Error(reason || `${command} failed.`);
  }
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

/** @param {string} folder @param {string} file */
export async function openVSCode(folder, file) {
  const result = await exec("code", ["--reuse-window", folder, "--goto", file]);
  if (result.code !== 0) throw new Error(result.stderr || "Could not open VS Code. Install its code command or use the displayed file path.");
}

/** VS Code's own diff view: your answer on the left, the reference on the right. @param {string} answer @param {string} reference */
export async function openVSCodeDiff(answer, reference) {
  const result = await exec("code", ["--reuse-window", "--diff", answer, reference]);
  if (result.code !== 0) throw new Error(result.stderr || "Could not open VS Code. Install its code command or open the files yourself.");
}

/** Open the diff in a running Neovim. False when it isn't reachable. @param {string} server @param {string} expression */
export async function neovimDiff(server, expression) {
  try {
    const result = await exec("nvim", ["--server", server, "--remote-expr", expression]);
    return result.code === 0;
  } catch { return false; }
}

/** Run Ex commands in a running Neovim. False when it isn't reachable. @param {string} server @param {string[]} commands */
export async function neovimCommands(server, commands) {
  const list = commands.map(command => `'${command.replaceAll("'", "''")}'`).join(", ");
  try {
    const result = await exec("nvim", ["--server", server, "--remote-expr", `execute([${list}])`]);
    return result.code === 0;
  } catch { return false; }
}

/**
 * Show another file in the running Neovim. Comparison tabs close first, so the file never
 * opens inside a diff window.
 * @param {string} server @param {string} file
 */
export async function reuseNeovim(server, file) {
  try {
    await exec("nvim", ["--server", server, "--remote-expr", neovimCloseDiffsExpression()]);
    const result = await exec("nvim", ["--server", server, "--remote", file]);
    return result.code === 0;
  } catch { return false; }
}

/** @returns {Promise<import("./tutor/config.js").TutorConfig>} */
export async function configuredTutor() {
  return parseTutorConfig(await readTextFile(`${appHome()}/practice-range.json`));
}

/** @param {import("./tutor/config.js").TutorProvider | null} provider */
export async function saveTutorPreference(provider) {
  const path = `${appHome()}/practice-range.json`;
  await saveTutorConfig(provider, { read: () => readTextFile(path), write: (text, expected) => writeTextFile(path, text, expected) });
}

/** @param {string} action @param {string} value */
async function tutorCommand(action, value) {
  const result = await exec("node", [`${appHome()}/mods/practice-range/tutor/service.mjs`, practiceDirectory(), `${appHome()}/practice-range.json`, action, value], { timeout: 150000 });
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
