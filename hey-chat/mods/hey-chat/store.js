// What Hey, chat keeps on disk (scope section 9): <appHome>/data/hey-chat/chats.json holds each
// real chat's id, folder, agent, title, the agent's session id and when it last changed, and the
// folders you chat in. Messages aren't copied: a running bridge replays them, and (A6) the
// agent's own session file has them.
import { readTextFile, writeTextFile, appHome, home, checking } from "herdr";
import * as fs from "fs/promises";

/** @typedef {{ id: string, path: string, cwd: string }} Project */

function file() {
  return `${appHome().replace(/\\/g, "/")}/data/hey-chat/chats.json`;
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

/** @returns {Promise<{ chats: any[], projects: { id: string, path: string }[] }>} */
export async function loadStore() {
  const text = await readTextFile(file()).catch(() => null);
  try {
    const s = JSON.parse(text ?? "");
    return { chats: Array.isArray(s.chats) ? s.chats : [], projects: Array.isArray(s.projects) ? s.projects : [] };
  } catch {
    return { chats: [], projects: [] };
  }
}

/**
 * Saves the real chats (not the samples) and the folders they're in.
 * @param {any[]} chats @param {Project[]} projects
 */
export async function saveStore(chats, projects) {
  if (checking()) return;
  const real = chats.filter((c) => c.real).map((c) => ({
    id: c.id, project: c.project, cwd: c.cwd, agent: c.agent, title: c.title, session: c.session ?? null, stamp: c.stamp, time: c.time,
  }));
  const used = new Set(real.map((c) => c.project));
  const folders = projects.filter((p) => p.saved || used.has(p.id)).map((p) => ({ id: p.id, path: p.path }));
  await fs.mkdir(file().replace(/\/[^/]+$/, ""), { recursive: true }).catch(() => null);
  await writeTextFile(file(), `${JSON.stringify({ chats: real, projects: folders }, null, 2)}\n`, null).catch(() => null);
}
