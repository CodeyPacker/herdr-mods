// Device sync: keeps your progress and answers in a git repo you own, so another computer can
// pick up where you left off. Off unless practice-range.json has "sync": true.
//   node sync.mjs <practice folder> pull|push
// pull runs as Practice Range opens, push as it closes. The practice folder must be a clone of
// your repo. Only progress is committed (see GITIGNORE). Prints { message } or { error } as JSON.
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Everything is ignored except each language's session, answers and backups. */
const LEGACY_GITIGNORE = `# Practice Range device sync: only progress and answers are shared.
/*
!/.gitignore
!/session.json
!/answers/
!/history/
!/languages/
/languages/*/*
!/languages/*/session.json
!/languages/*/answers/
!/languages/*/history/
_reference/
bin/
obj/
node_modules/
*.bak*
`;

// Only learner-owned course records travel. Checker files and machine attachments stay local.
const COURSE_GITIGNORE = LEGACY_GITIGNORE + `!/courses/
/courses/*
!/courses/*/
/courses/*/*
!/courses/*/*/
/courses/*/*/*
!/courses/*/*/enrollment.json
!/courses/*/*/answers/
!/courses/*/*/history/
`;
const VERSIONED_GITIGNORE = COURSE_GITIGNORE + "!/courses/*/current.json\n";
const IMPORT_GITIGNORE = VERSIONED_GITIGNORE + "!/courses/*/*/pack.json\n!/courses/*/*/import.json\n";
export const GITIGNORE = IMPORT_GITIGNORE + "!/courses/*/*/repo-lessons.json\n";

/** @param {string} folder @param {string[]} args @returns {Promise<{ code: number, stdout: string, stderr: string }>} */
function git(folder, args) {
  return new Promise(resolve => {
    execFile("git", ["-C", folder, ...args], { timeout: 60000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout, stderr: stderr || (error && !stderr ? error.message : "") });
    });
  });
}

/** @param {string} folder @param {string[]} args */
async function must(folder, args) {
  const result = await git(folder, args);
  if (result.code !== 0) throw new Error(`git ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

/** The repo must be this folder itself, not a repo the folder happens to sit inside. @param {string} folder */
async function checkRepo(folder) {
  const top = await git(folder, ["rev-parse", "--show-toplevel"]);
  const here = await git(folder, ["rev-parse", "--show-prefix"]);
  if (top.code !== 0 || here.stdout.trim() !== "") {
    throw new Error(`Device sync is on, but ${folder} is not a git repo. Clone your progress repo there, or remove "sync" from practice-range.json.`);
  }
}

/** Upgrade our previous allow-list. A user-edited one is left alone. @param {string} folder */
async function ensureGitignore(folder) {
  const path = join(folder, ".gitignore");
  try {
    const existing = await readFile(path, "utf8");
    if ([LEGACY_GITIGNORE, COURSE_GITIGNORE, VERSIONED_GITIGNORE, IMPORT_GITIGNORE].includes(existing)) await writeFile(path, GITIGNORE);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(path, GITIGNORE);
  }
}

/** @param {string} folder */
export async function pull(folder) {
  await checkRepo(folder);
  // A repo set up with git init, or cloned while the remote was empty, has no upstream until
  // the remote has commits. Fetch first so a clone sees them.
  await must(folder, ["fetch", "--quiet"]);
  const tracking = (await git(folder, ["rev-parse", "--abbrev-ref", "@{u}"])).code === 0;
  // After the pull: a new computer's own .gitignore would block the pulled one.
  if (tracking) await must(folder, ["pull", "--rebase", "--autostash"]);
  await ensureGitignore(folder);
  return tracking ? "Pulled progress." : "Nothing to pull yet.";
}

/** @param {string} folder */
export async function push(folder) {
  await checkRepo(folder);
  await ensureGitignore(folder);
  await must(folder, ["add", "-A"]);
  const staged = await git(folder, ["diff", "--cached", "--quiet"]);
  if (staged.code !== 0) await must(folder, ["commit", "-m", `Practice progress from ${hostname()}`]);
  // Pushes earlier commits too, in case a previous push failed.
  // -u sets the upstream on the first push from a repo made with git init.
  await must(folder, ["push", "-u", "origin", "HEAD"]);
  return staged.code !== 0 ? "Pushed progress." : "No new progress.";
}

// Herdr installations may symlink the mod directory, so compare real paths.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [folder, action] = process.argv.slice(2);
  try {
    if (!folder || !["pull", "push"].includes(action)) throw new Error("Usage: node sync.mjs <practice folder> pull|push");
    const message = action === "pull" ? await pull(folder) : await push(folder);
    process.stdout.write(JSON.stringify({ message }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  }
}
