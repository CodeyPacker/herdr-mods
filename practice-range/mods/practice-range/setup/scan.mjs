// What this computer already has, found without installing anything. Setup draws its cards
// from this, so nobody has to press "check" first. Every probe runs at the same time, and the
// slow AI tool probes are a separate scan so they never hold up the language and editor cards.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runProcess } from "../process.mjs";
import { languages } from "../languages/index.js";
import { loadLanguageRunner } from "../languages/runner.mjs";
import { checkProvider } from "../tutor/providers.mjs";

/** How long one probe may take before it counts as missing. */
const PROBE_MS = 10000;

/**
 * Run `command --version` and keep its first line. Missing commands resolve to found: false.
 * @param {string} command @param {typeof runProcess} run
 * @returns {Promise<{ found: boolean, version: string }>}
 */
async function probe(command, run) {
  try {
    const result = await run(command, ["--version"], { timeout: PROBE_MS });
    const version = result.stdout.split("\n")[0].trim();
    return result.code === 0 && !result.problem ? { found: true, version } : { found: false, version: "" };
  } catch { return { found: false, version: "" }; }
}

/** How many of a pack's exercises have passed at least once. A missing session is 0. */
async function passedCount(root, pack) {
  try {
    const session = JSON.parse(await readFile(join(root, pack.dataDirectory, "session.json"), "utf8"));
    return Object.values(session.progress ?? {}).filter(entry => entry?.passes > 0).length;
  } catch { return 0; }
}

/** One pack: whether its runtime works, and how far the person has come. */
async function scanPack(root, pack) {
  const [environment, passed] = await Promise.all([
    loadLanguageRunner(pack.id).then(runner => runner.environment()).then(
      version => ({ ready: true, detail: version.label ?? version.version }),
      error => ({ ready: false, detail: error instanceof Error ? error.message : String(error) })),
    passedCount(root, pack),
  ]);
  return { ...environment, passed, total: pack.exercises.length };
}

/**
 * Node, every language pack, and both editors.
 * @param {string} root the practice directory
 * @returns {Promise<import("../types.js").ToolScan>}
 */
export async function scanTools(root, { run = runProcess } = {}) {
  const [packs, neovim, vscode] = await Promise.all([
    Promise.all(languages.map(pack => scanPack(root, pack))),
    probe("nvim", run),
    probe("code", run),
  ]);
  return {
    node: { ready: Number(process.versions.node.split(".")[0]) >= 20, version: process.versions.node },
    languages: Object.fromEntries(languages.map((pack, index) => [pack.id, packs[index]])),
    editors: { neovim, vscode },
  };
}

/**
 * The Claude Code and Codex commands: installed, which version, and whether they can tutor
 * (new enough and signed in). Uses the same check as connecting does.
 * @returns {Promise<import("../types.js").TutorScan>}
 */
export async function scanTutors({ run = runProcess } = {}) {
  /** @param {"claude" | "codex"} provider */
  const scan = async provider => {
    const found = await probe(provider, run);
    if (!found.found) return { ...found, ready: false, detail: "" };
    try { await checkProvider(provider); return { ...found, ready: true, detail: "" }; }
    catch (error) { return { ...found, ready: false, detail: error instanceof Error ? error.message : String(error) }; }
  };
  const [claude, codex] = await Promise.all([scan("claude"), scan("codex")]);
  return { claude, codex };
}
