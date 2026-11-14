// Where the tickets are and how the mod reads them. The board and the slot both use this.
import { appHome, exec, panes } from "herdr";

/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {{ number: number, title: string, description: string, criteria: string[], status: string, question: string, summary: string, terminal?: string, needs?: number[], auto?: boolean, answer?: string, feedback?: string, base?: string, tour?: boolean, pr?: number, prUrl?: string }} Ticket */
/** @typedef {{ key: string, name: string, root: string, tickets: Ticket[] }} Project */
/** @typedef {{ id: string, label: string }} Status */
/** @typedef {{ statuses: Status[], current: string | null, projects: Project[] }} BoardData every project and its tickets, as ticket.mjs reports them */

const appDir = () => appHome().replace(/\\/g, "/");
/** The script that reads and writes tickets. */
export const script = () => `${appDir()}/mods/tickets/ticket.mjs`;
/** The folder every project's tickets are in. */
export const dataDir = () => `${appDir()}/data/tickets`;

/**
 * True when every path a folder watch reported is inside the tickets' worktrees. Agents change
 * files there all the time, and none of it is a ticket, so the board need not be read again.
 * @param {string[]} paths
 */
export function onlyWorktrees(paths) {
  const same = (/** @type {string} */ path) => path.replace(/\\/g, "/").toLowerCase();
  const inside = `${same(dataDir())}/worktrees/`;
  return paths.length > 0 && paths.every((path) => same(path).startsWith(inside));
}

/**
 * Where a space is right now: the folder of the focused pane in the tab it shows, then any pane
 * in that tab, then any pane in the space, then where its new terminals start. A space's own
 * folder is often the home folder, so the panes say which repo it is on.
 * @param {SpaceInfo} s
 */
export function folderOf(s) {
  const ps = panes();
  const shown = new Set(s.tabs.filter((tab) => tab.active).map((tab) => tab.id));
  const all = new Set(s.tabs.map((tab) => tab.id));
  return ps.find((p) => shown.has(p.tab) && p.focused && p.cwd)?.cwd
    || ps.find((p) => shown.has(p.tab) && p.cwd)?.cwd
    || ps.find((p) => all.has(p.tab) && p.cwd)?.cwd
    || s.folder;
}

/**
 * Asks ticket.mjs for every project and its tickets. It also makes the data folder, so a
 * watch on it has something to watch. Rejects with the script's own message.
 * @param {string} [folder] a folder whose project is reported as `current`
 * @returns {Promise<BoardData>}
 */
export async function readBoard(folder) {
  const r = await exec("node", [script(), "board", "--json", ...(folder ? ["--for", folder] : [])]);
  if (r.code !== 0) throw new Error(r.stderr.trim() || `ticket.mjs exited with ${r.code}`);
  return JSON.parse(r.stdout);
}
