// Tutor's own settings, shared by every course: the editor, the agent, and what the learner knows
// (the default for the next new course; each course keeps its own copy). data/tutor/settings.json.
import { readTextFile } from "herdr";
import * as fs from "fs/promises";
import { dataDir } from "./course.js";
import { DEFAULT_KNOWN } from "./learner.js";

export const EDITORS = { neovim: "Neovim", vscode: "VS Code" };
export const AGENTS = { claude: "Claude", codex: "Codex" };

const path = () => `${dataDir()}/settings.json`;

/** { editor, agent, known } with defaults for anything missing or unknown. */
export function cleanSettings(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    editor: s.editor in EDITORS ? s.editor : "neovim",
    agent: s.agent in AGENTS ? s.agent : "claude",
    known: Array.isArray(s.known) ? s.known.filter(k => typeof k === "string" && k.trim()).map(k => k.trim()) : DEFAULT_KNOWN,
  };
}

export async function loadSettings() {
  const text = await readTextFile(path()).catch(() => null);
  try { return cleanSettings(text ? JSON.parse(text.replace(/^﻿/, "")) : null); }
  catch { return cleanSettings(null); }
}

export async function saveSettings(s) {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(path(), JSON.stringify(cleanSettings(s), null, 2));
}

/** The next key in `table` after `id`, for the setup screen's toggles. */
export const nextOf = (table, id) => { const ids = Object.keys(table); return ids[(ids.indexOf(id) + 1) % ids.length]; };
