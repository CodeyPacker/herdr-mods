#!/usr/bin/env node
// The skills an agent has loaded in a folder, for the message box's / menu.
//
//   node skills.mjs --agent claude|codex --cwd <folder>
//       Prints a JSON array: { name, description, path? }, sorted by name.
//
// Claude: `claude -p` runs `/cost` (a local command, no model call, hooks off) and reports what it
// loaded in its init line. Descriptions come from each skill's SKILL.md where one is found.
// Codex: `codex app-server` answers skills/list, with descriptions and the SKILL.md path that a
// skill input needs.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { askClaude, withCodex } from "./agent-cli.mjs";
import { flags } from "./cli.mjs";

const HOME = homedir();

/** A SKILL.md's description, from its front matter. @param {string} file */
function describe(file) {
  try {
    const head = readFileSync(file, "utf8").slice(0, 4000);
    const m = /^description:\s*(.+)$/m.exec(head);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch { return ""; }
}

/** Every SKILL.md under a folder, at most `depth` folders down, by skill folder name. @param {string} dir @param {number} depth @param {Map<string, string>} out */
function findSkills(dir, depth, out) {
  let names = [];
  try { names = readdirSync(dir); } catch { return; }
  if (names.includes("SKILL.md")) {
    const name = basename(dir);
    if (!out.has(name)) out.set(name, join(dir, "SKILL.md"));
    return;
  }
  if (depth === 0) return;
  for (const n of names) {
    if (n.startsWith(".") && n !== ".claude") continue;
    const p = join(dir, n);
    try { if (statSync(p).isDirectory()) findSkills(p, depth - 1, out); } catch { /* gone */ }
  }
}

/** @param {string} cwd @returns {Promise<{ name: string, description: string }[]>} */
async function claudeSkills(cwd) {
  const args = ["--no-session-persistence", "--settings", JSON.stringify({ disableAllHooks: true })];
  const names = await askClaude(cwd, args, { type: "user", message: { role: "user", content: "/cost" } },
    (ev) => ev.type === "system" && ev.subtype === "init" ? (Array.isArray(ev.skills) ? ev.skills : []) : undefined, []);
  // Descriptions: your skills, the folder's, then the plugins'.
  const files = new Map();
  findSkills(join(cwd, ".claude", "skills"), 1, files);
  findSkills(join(HOME, ".claude", "skills"), 3, files); // synced ones sit in skills/synced/<bucket>/
  findSkills(join(HOME, ".claude", "plugins"), 7, files);
  return names.map((/** @type {string} */ name) => {
    const file = files.get(name.split(":").pop() ?? name);
    return { name, description: file ? describe(file) : "" };
  });
}

/** @param {string} cwd @returns {Promise<{ name: string, description: string, path: string }[]>} */
async function codexSkills(cwd) {
  try {
    return await withCodex(cwd, async (call) => {
      const r = await call("skills/list", { cwds: [cwd] });
      const skills = (r?.data ?? []).flatMap((/** @type {any} */ e) => e.skills ?? []).filter((/** @type {any} */ s) => s.enabled !== false);
      return skills.map((/** @type {any} */ s) => ({ name: String(s.name), description: String(s.shortDescription || s.description || ""), path: String(s.path ?? "") }));
    });
  } catch { return []; }
}

const opts = flags(process.argv.slice(2));
const cwd = opts.cwd && existsSync(opts.cwd) ? opts.cwd : HOME;
const list = await (opts.agent === "codex" ? codexSkills(cwd) : claudeSkills(cwd));
const seen = new Set();
const out = list.filter((s) => s.name && !seen.has(s.name) && seen.add(s.name)).sort((a, b) => a.name.localeCompare(b.name));
process.stdout.write(JSON.stringify(out));
