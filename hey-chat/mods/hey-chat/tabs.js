// Each project's chat lives in its own tab. The shortcut opens the tab for the focused folder, or
// goes back to the tab you came from when you are already in a chat tab.
import { panes, spaces, run, focused, shared, setShared, home } from "herdr";
import { expand } from "./store.js";
import { folderName, normalFolder } from "./common.js";

/** Chat tabs by tab id: { folder, previous }, where `previous` is the tab to go back to. */
const CHAT_TABS = "hey-chat.projectTabs";

/** A chat tab's name. @param {string} folder */
function tabName(folder) {
  return `Chat · ${folderName(folder)}`;
}

/**
 * The shortcut: goes back from a chat tab, else opens (or focuses) the chat tab for `folder`, by
 * default the focused folder. A chat pane split beside a terminal, from older versions, is closed
 * once its tab exists.
 * @param {any} cx @param {string} [folder]
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
  folder = normalFolder(expand(folder ?? f?.cwd ?? space.folder ?? home()));
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

/** Records the tab a pane runs in as `folder`'s chat tab, and names it. @param {string | undefined} pane @param {string} folder */
export function claimTab(pane, folder) {
  const own = panes().find(p => p.pane === pane);
  if (!own) return;
  const tabs = shared(CHAT_TABS) ?? {};
  setShared(CHAT_TABS, { ...tabs, [own.tab]: { ...tabs[own.tab], folder } });
  run("tab.rename", { id: own.tab, name: tabName(folder) });
}
