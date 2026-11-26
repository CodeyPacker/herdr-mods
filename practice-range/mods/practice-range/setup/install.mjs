// Installs what a language pack needs, from the panel, so nobody has to find the mod's folder
// in a terminal. Only packs whose install kind is "npm" can be installed here: npm ci reads the
// pack's package-lock.json, so it installs exactly the pinned versions the checks expect.
import { fileURLToPath } from "node:url";
import { runProcess } from "../process.mjs";
import { findLanguage } from "../languages/index.js";

/** npm downloads once from its registry. A slow connection still finishes inside this. */
const INSTALL_MS = 300000;

/** The last lines of npm's output, which name what went wrong. @param {string} text */
function tail(text) {
  return text.trim().split("\n").slice(-6).join("\n");
}

/**
 * Run npm ci in the pack's folder. Resolves when the pack is installed, rejects with npm's own
 * message when it is not.
 * @param {string} languageId @param {{ run?: typeof runProcess }} [options]
 */
export async function installPack(languageId, { run = runProcess } = {}) {
  const pack = findLanguage(languageId);
  if (pack.install.kind !== "npm") throw new Error(`${pack.name} needs ${pack.install.what}, which you install yourself.`);
  const folder = fileURLToPath(new URL(`../languages/${pack.id}/`, import.meta.url));
  const args = ["ci", "--no-audit", "--no-fund", "--loglevel=error"];
  // Windows ships npm as npm.cmd, which Node only starts through cmd.
  const [command, argv] = process.platform === "win32" ? ["cmd", ["/c", "npm", ...args]] : ["npm", args];
  let result;
  try { result = await run(command, argv, { cwd: folder, timeout: INSTALL_MS, maxOutput: 1000000 }); }
  catch { throw new Error("npm is not available. Install Node.js 20 or newer, which includes npm, then restart Herdr."); }
  if (result.problem) throw new Error("npm ci took longer than 5 minutes. Check your internet connection, then try again.");
  if (result.code !== 0) throw new Error(`npm ci failed in ${folder}\n${tail(result.stderr || result.stdout)}`);
  return { installed: pack.id };
}
