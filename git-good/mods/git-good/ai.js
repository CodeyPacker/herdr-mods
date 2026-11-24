// Asks the Claude CLI to write a commit message for the staged changes. Claude reads them
// itself with git's read commands, so no diff has to fit on a command line. It can change nothing.
import { appHome, exec, window as appWindow } from "herdr";
import { cleanMessage } from "./parse.js";

/** @typedef {import("./git.js").Repo} Repo */

const PROMPT = [
  "Write a git commit message for the staged changes in this repository.",
  "Run git diff --cached to read them. Run git log -5 --format=%s to match the style of recent subjects.",
  "Reply with the commit message and nothing else: a subject line of at most 72 characters, then, only if it adds something, a blank line and a short body.",
  "No code fence, no quotes, no preamble, no co-author line.",
].join(" ");

/** The only commands Claude may run. */
const TOOLS = ["--allowedTools", "Bash(git diff:*)", "Bash(git log:*)"];

/** How long Claude may take, in milliseconds. */
const TIMEOUT_MS = 180000;

/**
 * A commit message for the staged changes. Never throws.
 * @param {Repo} repo @param {string | null} on the repo's machine: Claude runs there
 * @returns {Promise<{ ok: boolean, text: string }>} `text` is the message, or why there is none
 */
export async function writeMessage(repo, on) {
  try {
    const args = ["-p", PROMPT, ...TOOLS], options = { cwd: repo.top, on: on ?? null, timeout: TIMEOUT_MS };
    const r = await exec("claude", args, options).catch(e => retryOnWindows(e, args, options));
    const text = cleanMessage(r.stdout);
    if (r.code !== 0 || !text) return { ok: false, text: (r.stderr || r.stdout || "Claude returned nothing").trim().slice(-300) };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, text: `Could not run claude: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Windows only: Herdr's PATH can miss ~/.local/bin, where Claude's installer puts claude.exe.
 * When "claude" is not found on this computer, run it from there. Anything else fails as before.
 * @param {unknown} error @param {string[]} args @param {{ cwd: string, on: string | null, timeout: number }} options
 */
function retryOnWindows(error, args, options) {
  const notFound = /program not found/i.test(error instanceof Error ? error.message : String(error));
  if (appWindow()?.platform !== "windows" || options.on || !notFound) throw error;
  const home = appHome().replace(/\\/g, "/").replace(/\/\.config\/herdr-app\/?$/i, "");
  return exec(`${home}/.local/bin/claude.exe`, args, options);
}
