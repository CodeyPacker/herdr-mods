// Asks the Claude CLI to write a commit message for the staged changes. Claude reads them
// itself with git's read commands, so no diff has to fit on a command line. It can change nothing.
import { exec } from "herdr";
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
    const r = await exec("claude", ["-p", PROMPT, ...TOOLS], { cwd: repo.top, on: on ?? null, timeout: TIMEOUT_MS });
    const text = cleanMessage(r.stdout);
    if (r.code !== 0 || !text) return { ok: false, text: (r.stderr || r.stdout || "Claude returned nothing").trim().slice(-300) };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, text: `Could not run claude: ${e instanceof Error ? e.message : String(e)}` };
  }
}
