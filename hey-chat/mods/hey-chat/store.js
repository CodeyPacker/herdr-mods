// What Hey, chat keeps on disk: <appHome>/data/hey-chat/chats.json holds each
// real chat's id, folder, agent, title, the agent's session id and file, when it last changed, and the
// folders you chat in. Messages aren't copied: a running bridge replays them, and the
// agent's own session file has them.
import { readTextFile, writeTextFile, home, checking } from "herdr";
import * as fs from "fs/promises";
import { dataDir } from "./common.js";

/** @typedef {{ id: string, path: string, cwd: string, made?: boolean }} Project */

function file() {
  return `${dataDir()}/chats.json`;
}

/** `~/x` to an absolute path. @param {string} path */
export function expand(path) {
  return path.startsWith("~") ? `${home().replace(/\\/g, "/")}${path.slice(1)}` : path;
}

/** An absolute path shown with `~` for home. @param {string} cwd */
export function tilde(cwd) {
  const h = home().replace(/\\/g, "/");
  return cwd === h || cwd.startsWith(`${h}/`) ? `~${cwd.slice(h.length)}` : cwd;
}

/** @returns {Promise<{ chats: any[], projects: { id: string, path: string, made?: boolean }[], activeChat: string | null, activeChats: Record<string, string | null> }>} */
export async function loadStore() {
  const text = await readTextFile(file()).catch(() => null);
  try {
    const s = JSON.parse(text ?? "");
    return { chats: Array.isArray(s.chats) ? s.chats : [], projects: Array.isArray(s.projects) ? s.projects : [], activeChats: s.activeChats && typeof s.activeChats === "object" ? s.activeChats : {}, activeChat: typeof s.activeChat === "string" ? s.activeChat : null };
  } catch {
    return { chats: [], projects: [], activeChat: null, activeChats: {} };
  }
}

// Keep saves in order so a slower earlier save cannot replace a newer session id.
let saving = Promise.resolve();

/**
 * Saves the chats that have a session (a new chat you never wrote in has none) and the folders they're in.
 * @param {any[]} chats @param {Project[]} projects @param {string} [activeChat] @param {string} [folder]
 */
export async function saveStore(chats, projects, activeChat, folder) {
  if (checking()) return;
  const real = chats.filter((c) => c.session || c.draft || c.attached?.length || c.pinned || c.customTitle || c.parentId || c.linkId).map((c) => ({
    id: c.id, linkId: c.linkId ?? null, parentId: c.parentId ?? null, project: c.project, cwd: c.cwd, agent: c.agent, model: c.model ?? null, selectedModel: c.selectedModel ?? null, title: c.title, customTitle: Boolean(c.customTitle), pinned: Boolean(c.pinned), outputs: c.outputs ?? [], draft: c.draft ?? "", attached: c.attached ?? [], session: c.session ?? null, file: c.file ?? null, stamp: c.stamp, time: c.time,
  }));
  const used = new Set(real.map((c) => c.project));
  // Folders with chats, and the projects you made (kept while they have none yet).
  const folders = projects.filter((p) => used.has(p.id) || p.made).map((p) => ({ id: p.id, path: p.path, ...(p.made ? { made: true } : {}) }));
  saving = saving.catch(() => {}).then(async () => {
    await fs.mkdir(file().replace(/\/[^/]+$/, ""), { recursive: true });
    for (let attempt = 0; attempt < 5; attempt++) {
      const expected = await readTextFile(file());
      let previous;
      try { previous = JSON.parse(expected ?? "{}"); } catch { previous = {}; }
      const merged = folder ? {
        chats: [...(previous.chats ?? []).filter(c => c.cwd !== folder), ...real],
        projects: [...(previous.projects ?? []).filter(p => expand(p.path) !== folder), ...folders],
        activeChat: previous.activeChat ?? null,
        activeChats: { ...previous.activeChats, [folder]: activeChat ?? null },
      } : { ...previous, chats: real, projects: folders, activeChat: activeChat ?? null };
      try {
        await writeTextFile(file(), `${JSON.stringify(merged, null, 2)}\n`, expected);
        return;
      } catch (error) {
        if (attempt === 4 || await readTextFile(file()) === expected) throw error;
        // Another project saved first. Merge again against its new snapshot.
      }
    }
  });
  await saving;
}
