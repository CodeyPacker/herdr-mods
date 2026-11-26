// Each project's chat lives in its own tab. The shortcut opens the tab for the focused folder, or
// goes back to the tab you came from when you are already in a chat tab.
import { panes, spaces, run, focused, shared, setShared, home } from "herdr";
import { expand } from "./store.js";
import { folderName, normalFolder } from "./common.js";

/** Chat tabs by tab id: { folder, previous }, where `previous` is the tab to go back to. */
const CHAT_TABS = "hey-chat.projectTabs";

/** A chat tab's name. @param {string} folder */
function tabName(folder) {
  return folderName(folder);
}

/**
 * The folder a new chat is for: the focused terminal's, else (a mod tab has none) a terminal's in
 * the same tab, else the first terminal's in the space's tabs, else the space's own folder. Home
 * never counts: it isn't a project, and spaces and shells start there. Null when there is none:
 * the person picks a project instead.
 * @param {any} space @param {string | undefined} current the shown tab
 * @param {string | null | undefined} cwd the focused folder @param {any[]} all every pane
 * @returns {string | null}
 */
export function spaceFolder(space, current, cwd, all) {
  const homeFolder = normalFolder(home()).toLowerCase();
  /** @param {any} f */
  const project = (f) => Boolean(f) && normalFolder(expand(String(f))).toLowerCase() !== homeFolder;
  if (project(cwd)) return /** @type {string} */ (cwd);
  const inTab = (/** @type {string | undefined} */ tab) => all.find(p => p.tab === tab && p.terminal && project(p.cwd))?.cwd;
  const here = inTab(current);
  if (here) return here;
  for (const t of space.tabs) { const found = inTab(t.id); if (found) return found; }
  return project(space.folder) ? space.folder : null;
}

/**
 * The shortcut: goes back from a chat tab, else opens (or focuses) the chat tab for `folder`, by
 * default the focused folder (spaceFolder). A chat pane split beside a terminal, from older
 * versions, is closed once its tab exists. Returns "choose" when there is no folder to use.
 * @param {any} cx @param {string} [folder]
 * @returns {Promise<"choose" | void>}
 */
export async function toggle(cx, folder) {
  const f = focused();
  const space = spaces().find(s => s.id === f?.space) ?? spaces().find(s => s.active);
  if (!space) return;
  const current = f?.tab ?? space.tabs.find(t => t.active)?.id;
  const saved = shared(CHAT_TABS) ?? {};
  const all = panes().slice();
  const currentChat = saved[current];
  if (!folder && currentChat && all.some(p => p.tab === current && p.mod === "hey-chat")) {
    const back = space.tabs.find(t => t.id === currentChat.previous)
      ?? space.tabs.find(t => t.id !== current && !t.settled)
      ?? space.tabs.find(t => t.id !== current);
    if (back) run("tab.select", { id: back.id });
    return;
  }
  const found = folder ?? spaceFolder(space, current, f?.cwd, all);
  if (!found) return "choose";
  folder = normalFolder(expand(found));
  const tab = space.tabs.find(t => saved[t.id]?.folder === folder && all.some(p => p.tab === t.id && p.mod === "hey-chat"));
  if (tab) {
    if (current !== tab.id) {
      setShared(CHAT_TABS, { ...saved, [tab.id]: { folder, previous: current } });
      run("tab.select", { id: tab.id });
    }
    return;
  }
  const legacy = all.find(p => p.mod === "hey-chat" && p.tab === current && all.some(other => other.tab === current && other.mod !== "hey-chat"));
  run("tab.new", { name: tabName(folder), space: space.id, mod: "hey-chat", props: { folder } });
  for (let i = 0; i < 30; i++) {
    const made = panes().find(p => p.mod === "hey-chat" && !all.some(old => old.pane === p.pane));
    if (made) {
      setShared(CHAT_TABS, { ...(shared(CHAT_TABS) ?? {}), [made.tab]: { folder, previous: current } });
      if (legacy) run("pane.close", { pane: legacy.pane });
      return;
    }
    await new Promise((done) => cx.timer.after(16, done));
  }
}

/** A quick chat's tab name. */
export const QUICK_TAB = "Quick";

/** Opens a quick chat: a new tab whose chat isn't saved, in an empty folder (main.js). */
export function openQuick() {
  const f = focused();
  const space = spaces().find(s => s.id === f?.space) ?? spaces().find(s => s.active);
  run("tab.new", { name: QUICK_TAB, ...(space ? { space: space.id } : {}), mod: "hey-chat", props: { quick: true } });
}

/**
 * Every chat tab in every space, in space then tab order: { tab, space, spaceName, folder, name,
 * status, current }. `current` is the tab on screen. A tab holding a split chat pane from older
 * versions is left out, since it is a terminal tab.
 */
export function chatTabs() {
  const saved = shared(CHAT_TABS) ?? {};
  const all = panes();
  const out = [];
  for (const s of spaces()) {
    for (const tab of s.tabs) {
      const mine = all.filter(p => p.tab === tab.id);
      if (!mine.some(p => p.mod === "hey-chat") || mine.some(p => p.mod !== "hey-chat")) continue;
      const folder = saved[tab.id]?.folder ?? null;
      const name = folder ? folderName(folder) : tab.name.replace(/^Chat · /, "");
      out.push({ tab: tab.id, pane: mine[0].pane, space: s.id, spaceName: s.name, folder, name, status: tab.status ?? null, current: s.active && tab.active });
    }
  }
  return out;
}

/**
 * Shows a chat tab, switching spaces first when it is in another, and gives its message box the
 * keyboard, so its keys (⌃p among them) work straight away.
 * @param {{ tab: string, pane?: string, space: string, current?: boolean }} entry
 */
export function showChatTab(entry) {
  if (!entry.current) {
    if (!spaces().find(s => s.id === entry.space)?.active) run("space.select", { id: entry.space });
    run("tab.select", { id: entry.tab });
  }
  if (entry.pane) run("pane.focus", { pane: entry.pane });
  run("hey-chat.focus");
}

/** Records the tab a pane runs in as `folder`'s chat tab, and names it. @param {string | undefined} pane @param {string} folder */
export function claimTab(pane, folder) {
  const own = panes().find(p => p.pane === pane);
  if (!own) return;
  const tabs = shared(CHAT_TABS) ?? {};
  setShared(CHAT_TABS, { ...tabs, [own.tab]: { ...tabs[own.tab], folder } });
  run("tab.rename", { id: own.tab, name: tabName(folder) });
}
