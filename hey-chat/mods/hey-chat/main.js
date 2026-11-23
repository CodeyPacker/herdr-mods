// Hey, chat: a Messenger-style chat with Claude Code or Codex, grouped by project folder.
// Scope and design: ../../SCOPE.md. Built so far: A1 (the pane, its layout and the opacity rules),
// A2 (keys and focus), A3 (Settings and your picture), A4 (Claude through the bridge), A5 (Codex)
// and A6 (your existing sessions, and search). The pieces:
//   store.js      the chats made here and their folders, kept in <appHome>/data/hey-chat/chats.json
//   agent.js      finding the CLIs, listing and reading sessions, and each chat's link to its bridge
//   bridge.mjs    the Node program that runs a chat's agent (started by agent.js)
//   sessions.mjs  the Node program that lists your Claude and Codex sessions and reads their history
//   messages.js   bridge events to messages, tool cards and permission cards
//   pictures.js   Claude's, Codex's and your profile pictures
//   me.js         your initials, color and picture, and copying a photo in
//   keys.js       the keys: moving between tree and chat, the tree cursor, scrolling the chat
//   views/        the sidebar (tree.js), the chat (chat.js) and the Settings card (settings.js)
import { View } from "gpui-kit";
import { h_flex, InputState, TextareaState, ScrollHandle } from "gpui-base";
import { nextCommand, panes, spaces, props, run, focused, closeOverlay, theme, window, playSound, checking, shared, setShared, home } from "herdr";
import { loadMe, saveMe, pickPhoto, importPhoto, dropPhoto } from "./me.js";
import { colors, paneBackground } from "./kit/theme.js";
import { AGENTS } from "./pictures.js";
import { Bridge, checkSetup, listSessions, readSession, deleteSession, pasteImage, listSkills, imageFile, listModels, outputFileAction } from "./agent.js";
import { applyEvent, resetThread, pendingAsk, pendingQuestion, clock, shortWhen, visibleMessages } from "./messages.js";
import { loadStore, saveStore, expand, tilde } from "./store.js";
import { pickProject } from "./folders.js";
import { treeView, TREE_WIDTH } from "./views/tree.js";
import { collectOutputs, webOutput } from "./outputs.js";
import { outputsView, OUTPUTS_WIDTH } from "./views/outputs.js";
import { setupView } from "./views/setup.js";
import { chatView, imageViewer } from "./views/chat.js";
import { handleKey, treeItems as treeItemsOf, LIST_PAD_TOP, LIST_PAD_BOTTOM } from "./keys.js";

/** The space around and between the two cards. */
const GAP = 10;

/** Project folders and return tabs for dedicated chat tabs. */
const CHAT_TABS = "hey-chat.projectTabs";

/** @param {any} cx @param {string} [folder] */
async function toggle(cx, folder) {
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
  folder = expand(folder ?? f?.cwd ?? space.folder ?? home()).replace(/\\/g, "/").replace(/\/$/, "") || "/";
  const tab = space.tabs.find(t => saved[t.id]?.folder === folder && all.some(p => p.tab === t.id && p.mod === "hey-chat"));
  if (tab) {
    if (current !== tab.id) {
      setShared(CHAT_TABS, { ...saved, [tab.id]: { folder, previous: current } });
      run("tab.select", { id: tab.id });
    }
    return;
  }
  const legacy = all.find(p => p.mod === "hey-chat" && p.tab === current && all.some(other => other.tab === current && other.mod !== "hey-chat"));
  run("tab.new", { name: `Hey, chat · ${folderName(folder)}`, space: space.id, mod: "hey-chat", props: { folder } });
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

/** Which projects are closed in the tree, kept across panes and restarts: { [project]: true }. */
const COLLAPSED = "hey-chat.collapsed";
/** Whether the sidebar is hidden (ctrl-b), kept across panes and restarts. */
const SIDEBAR_HIDDEN = "hey-chat.sidebarHidden";
/** Whether the key hints show (Settings), kept across panes and restarts. On unless turned off. */
const KEY_HINTS = "hey-chat.keyHints";
/** Hide routine tool activity unless the user turns it back on in profile settings. */
const CONDENSE_CHAT = "hey-chat.condenseChat";

/** A folder's last part. @param {string} path */
function folderName(path) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

export default class HeyChat extends View {
  init(_props, cx) {
    // The key's copy: an overlay. Panes Hey, chat runs in have no overlay.
    this.launcher = props()?.overlay !== undefined;
    if (this.launcher) {
      const overlay = props()?.overlay;
      cx.spawn(async (cx) => { try { await toggle(cx); } finally { closeOverlay(overlay); } });
      return;
    }
    /**
     * Every chat: { id, project, cwd, agent, title, time, stamp, session, file, last, lastFrom,
     * thread, working, ... }. `file` is its session file, once the agent has one.
     * @type {any[]}
     */
    this.chats = [];
    /** @type {import("./store.js").Project[]} */
    this.projects = [];
    this.chatId = "";
    this.unread = {};
    const saved = /** @type {any} */ (shared(COLLAPSED));
    this.collapsed = saved && typeof saved === "object" ? { ...saved } : {};
    this.query = "";               // the search box's text, lower case
    // Deleting a chat: { id, back, busy, error } while its y/n question shows. `back` is where the
    // keyboard was, to return it on n.
    this.deleting = null;
    this.sidebarHidden = shared(SIDEBAR_HIDDEN) === true;
    this.keyHints = shared(KEY_HINTS) !== false;
    this.condenseChat = shared(CONDENSE_CHAT) !== false;
    this.loaded = false;           // the sessions have been listed
    this.starting = !checking();   // keep the startup chat hidden until history and layout settle
    this.restoring = null;
    this.openTools = new Set();    // tool cards shown open
    /** @type {Map<string, Bridge>} each real chat's link to its bridge */
    this.bridges = new Map();
    /** @type {Map<string, Promise<Bridge | null>>} Connections still opening. */
    this.links = new Map();
    this.outputsOpen = false;
    this.chatSearchOpen = false;
    this.chatSearchIndex = 0;
    this.chatSearchInput = InputState.new({ placeholder: "Find in loaded messages" });
    this.chatSearchInput.on("focus", (_e, cx) => { this.zone = "chat-search"; cx.notify(); });
    this.chatSearchInput.on("change", (_e, cx) => { this.chatSearchIndex = 0; this.findChatMatch(0); cx.notify(); });
    this.outputPreview = null;
    this.outputError = null;
    this.setupOpen = Boolean(props()?.setup);
    this.setupAgent = "codex";
    this.setupChecking = false;
    this.setupState = null;
    this.agents = null;            // the CLIs on PATH, once found: ["node", "claude", ...]
    this.me = loadMe();
    // Settings: whether the card is open, a photo being copied in, and why the last one failed.
    this.settingsOpen = false;
    this.photoBusy = false; this.photoError = null;
    this.initialsInput = InputState.new({ placeholder: "Me", value: this.me.initials });
    this.initialsInput.on("focus", (_e, cx) => { this.zone = "settings"; cx.notify(); });
    this.initialsInput.on("change", (_e, cx) => {
      // One or two letters, upper case.
      const raw = this.initialsInput.value();
      const clean = raw.replace(/\s+/g, "").slice(0, 2).toUpperCase();
      if (clean !== raw) this.initialsInput.set_value(clean);
      this.me = { ...this.me, initials: clean };
      saveMe(this.me);
      cx.notify();
    });
    this.width = 0;
    this.height = 0;
    this.viewing = null;           // the image shown big over the pane ({ path, w, h }), or null
    this.modelPicker = null;
    // The / menu: each agent's skills by folder (loaded the first time you type /), the row it
    // has lit, and the box text it was closed for with esc (it stays closed until that changes).
    this.skillLists = new Map();
    this.slashIndex = 0;
    this.slashClosed = null;
    // Where the keyboard is: "chat" (the message box), "tree", "search" (the tree's search box),
    // "settings" (the initials box), "ask" (a permission bar is waiting on y, a or n) or
    // "confirm" (the delete question is waiting on y or n).
    this.zone = "chat";
    this.cursor = "";              // the tree row j and k are on (keys.js treeItems)
    this.anchor = null;            // where a selection started (v, or shift with j/k/arrows/click): a cursor key, or null
    // For ctrl-j and ctrl-k (keys.js scrollChat): each message row's height by its id, the
    // messages area's height, the scroll position the keys believe in, and whether it is at the end.
    this.rowHeights = new Map();
    this.viewH = 0; this.top = 0; this.atBottom = true;
    this.scroll = ScrollHandle.new();
    this.treeScroll = ScrollHandle.new(); // the sidebar list, scrolled to the j/k cursor
    this.treeKeys = [];            // the sidebar list's rows by cursor key, as views/tree.js drew them
    this.searchInput = InputState.new({ placeholder: "Search" });
    this.searchInput.on("focus", (_e, cx) => { this.zone = "search"; cx.notify(); });
    this.searchInput.on("change", (_e, cx) => { this.query = this.searchInput.value().trim().toLowerCase(); cx.notify(); });
    // The message box, one per agent so its placeholder names who you're talking to.
    this.inputs = {};
    for (const [id, a] of Object.entries(AGENTS)) {
      const box = TextareaState.new({ placeholder: `Message ${a.name}` });
      box.set_auto_grow(1, 8);
      box.on("change", (_e, cx) => { this.pastedPath(box, cx); this.slashChanged(cx); cx.notify(); });
      // Enter sends. Shift-enter is a new line. The box may add the new line itself on either
      // key, so this makes sure shift-enter has one and plain enter doesn't.
      box.on("submit", (e, cx) => {
        const at = box.selected_range().start, text = box.value();
        const added = text[at - 1] === "\n";
        if (e?.shift) { if (!added) box.replace("\n"); cx.notify(); return; }
        if (added) box.set_value(text.slice(0, at - 1) + text.slice(at));
        // Enter while the / menu is open picks its lit row.
        const items = this.slashItems();
        if (items?.length) { this.pickSlash(items[Math.min(this.slashIndex, items.length - 1)]); cx.notify(); return; }
        this.send(cx); cx.notify();
      });
      box.on("focus", (_e, cx) => { this.zone = "chat"; cx.notify(); });
      // A paste with no text: the clipboard's image, if it holds one, goes with the next message.
      box.on("paste_other", (_e, cx) => { this.pasteImage(cx); });
      this.inputs[id] = box;
    }
    this.handle = cx.focus_handle();
    cx.spawn(async (cx) => { for (;;) { this.command(await nextCommand(), cx); cx.notify(); } });
    // A new chat in the folder the pane was opened from, ready to type into. Your sessions fill
    // the tree around it once they're listed.
    const start = checking() ? home() : (props()?.folder ?? focused()?.cwd ?? home());
    this.folder = expand(start).replace(/\\/g, "/").replace(/\/$/, "") || "/";
    const own = panes().find(p => p.pane === props()?.pane);
    if (own && !checking()) {
      const tabs = shared(CHAT_TABS) ?? {};
      setShared(CHAT_TABS, { ...tabs, [own.tab]: { ...tabs[own.tab], folder: this.folder } });
      run("tab.rename", { id: own.tab, name: `Hey, chat · ${folderName(this.folder)}` });
    }
    const startId = this.addProject(this.folder);
    this.collapsed = { ...this.collapsed, [startId]: false };
    this.newChat(startId, cx);
    // The message box has the keyboard when the pane opens. The pane isn't drawn yet, so again once it is.
    this.focusInput();
    cx.timer.after(50, () => { if (this.zone === "chat") this.focusInput(); });
    cx.timer.after(400, () => { if (this.zone === "chat") this.focusInput(); });
    if (checking()) return;
    // Your sessions, the chats made here (reconnected to their bridges where those still run),
    // and the CLIs on PATH.
    cx.spawn(async (cx) => { await this.loadChats(cx); cx.notify(); });
    this.refreshSetup(cx, true);
  }

  async close() {
    if (this.launcher) return;
    for (const b of this.bridges.values()) b.close();
    this.scroll.release(); this.treeScroll.release(); this.searchInput.release(); this.initialsInput.release(); this.chatSearchInput.release();
    for (const box of Object.values(this.inputs)) box.release();
  }

  /** `hey-chat.<name>` commands: focus. */
  command(c, _cx) {
    if (c === "focus") this.focusInput();
  }

  // --- Projects and chats ----------------------------------------------------------------------

  /** The project for a folder, added when it's new. Returns its id. @param {string} cwd @param {string} [id] */
  addProject(cwd, id) {
    const found = this.projects.find((p) => p.cwd === cwd);
    if (found) return found.id;
    let name = id ?? folderName(cwd);
    if (this.projects.some((p) => p.id === name)) name = `${name} (${folderName(cwd.replace(/[\\/][^\\/]*$/, ""))})`;
    this.projects.push({ id: name, path: tilde(cwd), cwd, saved: true });
    // A project you haven't opened or closed starts closed.
    if (this.collapsed[name] === undefined) this.collapsed = { ...this.collapsed, [name]: true };
    return name;
  }

  /** The projects the tree shows, the one with the newest chat first. While searching, only those with a match. */
  visibleProjects() {
    const newest = (/** @type {string} */ id) => Math.max(0, ...this.chatsIn(id).map((c) => c.stamp ?? 0));
    return this.projects.filter((p) => !this.query || this.chatsIn(p.id).length > 0)
      .sort((a, b) => newest(b.id) - newest(a.id));
  }

  /** True when a project shows its chats: opened, or holding a search match. @param {string} id */
  isOpen(id) { return Boolean(this.query) || !this.collapsed[id]; }

  /** @param {string} id */
  project(id) { return this.projects.find((p) => p.id === id) ?? null; }

  /**
   * Fills the tree: the chats made here (chats.json), then every Claude and Codex session on this
   * computer (sessions.mjs), one chat per session. Chats whose bridge still runs are linked again.
   * @param {any} cx
   */
  async loadChats(cx) {
    const initialChat = this.chatId;
    const [s, sessions] = await Promise.all([loadStore(), listSessions()]);
    for (const p of s.projects) {
      if (!p?.path || (this.folder && expand(p.path) !== this.folder)) continue;
      const id = this.addProject(expand(p.path), p.id);
      if (p.made) { const made = this.project(id); if (made) made.made = true; }
    }
    for (const c of s.chats) {
      if (c?.cwd) c.cwd = c.cwd.replace(/\\/g, "/");
      if ((this.folder && c.cwd !== this.folder) || !c?.id || !c.session || this.chats.some((x) => x.id === c.id)) continue;
      const chat = { ...c, cwd: String(c.cwd ?? ""), project: this.addProject(String(c.cwd ?? ""), c.project), real: true, thread: [] };
      resetThread(chat);
      this.chats.push(chat);
    }
    for (const x of sessions) {
      x.cwd = x.cwd.replace(/\\/g, "/");
      if (this.folder && x.cwd !== this.folder) continue;
      const known = this.chats.find((c) => c.session === x.session);
      const facts = { file: x.file, model: x.model ?? known?.model ?? null, last: x.last, lastFrom: x.lastFrom, stamp: Math.max(known?.stamp ?? 0, x.updatedAt), time: shortWhen(x.updatedAt) };
      if (known) { Object.assign(known, facts); continue; }
      const chat = { id: `${x.agent}-${x.session}`, project: this.addProject(x.cwd), cwd: x.cwd, agent: x.agent, title: x.title,
        session: x.session, real: true, thread: [], ...facts };
      resetThread(chat);
      this.chats.push(chat);
    }
    const active = s.activeChats?.[this.folder] ?? s.activeChat;
    // Do not replace a conversation the user chose while sessions were loading.
    if (this.chatId === initialChat && !this.busy(this.chat(initialChat)) && !this.chat(initialChat)?.session && !this.chat(initialChat)?.thread.length && this.chats.some(c => c.id === active)) {
      this.restoring = { id: active, pending: true, version: 0 };
      this.openChat(active, cx);
      const restored = this.chat(this.chatId);
      this.setCollapsed(restored.project, false);
    }
    this.loaded = true;
    this.starting = false;
    this.saveChats();
    for (const c of this.chats) if (c.session) this.link(c, cx, false);
    cx.notify();
  }

  /**
   * Shows a chat's history from its session file: what came before `before` (when a bridge
   * replays the rest), or its last turns.
   * @param {any} chat @param {number} before @param {any} cx
   */
  async loadHistory(chat, before, cx) {
    if (!chat.file) return;
    chat.loading = true; cx.notify();
    const events = await readSession(chat.agent, chat.file, before);
    for (const ev of events) applyEvent(chat, ev);
    this.syncOutputs(chat, cx);
    chat.working = false;
    chat.loading = false;
    if (chat.id === this.chatId) this.scrollDown();
    cx.notify();
  }

  /** Saves the real chats. */
  saveChats() { return saveStore(this.chats, this.projects, this.chatId, this.folder).catch(e => console.error("Hey, chat couldn't save its conversations:", e)); }

  /** @param {string} id */
  chat(id) { return this.chats.find((c) => c.id === id) ?? this.chats[0]; }

  /** A project's chats, newest first. While searching, only those whose title, last message or folder match. @param {string} project */
  chatsIn(project) {
    const q = this.query;
    return this.chats.filter((c) => c.project === project && (!q || `${c.title} ${c.last ?? ""} ${c.project}`.toLowerCase().includes(q)))
      .sort((a, b) => b.stamp - a.stamp);
  }

  /** The two chats with the newest messages, from any project. */
  recentIds() {
    return this.folder ? [] : this.chats.slice().sort((a, b) => b.stamp - a.stamp).slice(0, 2).map((c) => c.id);
  }

  /** True while a chat's agent works on your message: the typing dots and "Thinking…". @param {any} chat */
  busy(chat) {
    return this.thinking(chat) || Boolean(chat?.reconnecting || chat?.thread?.some(m => m.queued));
  }

  /** Connection recovery is not agent work and must not add a typing row. @param {any} chat */
  thinking(chat) { return Boolean(chat?.working || chat?.connecting || chat?.modelSaving); }

  /** The permission card a chat is waiting on you for, or null. @param {any} chat */
  waiting(chat) {
    return chat ? pendingAsk(chat) : null;
  }

  /** The question card a chat is waiting on you for, or null. @param {any} chat */
  question(chat) {
    return chat ? pendingQuestion(chat) : null;
  }

  /** True while a chat waits on you: a permission or a question. @param {any} chat */
  needsYou(chat) {
    return Boolean(this.waiting(chat) || this.question(chat));
  }

  /** The open chat's agent's name. */
  chatAgentName() { return AGENTS[this.chat(this.chatId).agent]?.name ?? "The agent"; }

  /** @param {string} agent */
  inputFor(agent) { return this.inputs[agent] ?? this.inputs.claude; }

  // --- Focus -------------------------------------------------------------------------------------

  /** Gives the open chat's message box the keyboard, or the permission bar when one is waiting. */
  focusInput() {
    if (this.waiting(this.chat(this.chatId))) { this.zone = "ask"; this.handle.focus(); return; }
    this.zone = "chat";
    this.inputFor(this.chat(this.chatId).agent).focus();
  }

  /** Hides or shows the sidebar (ctrl-b), and remembers it. Hiding it takes the keyboard to the message box. */
  toggleSidebar() {
    this.setSidebarHidden(!this.sidebarHidden);
    if (this.sidebarHidden && ["tree", "search", "settings"].includes(this.zone)) { this.settingsOpen = false; this.focusInput(); }
  }

  /** @param {boolean} hidden */
  setSidebarHidden(hidden) {
    this.sidebarHidden = hidden;
    if (!checking()) setShared(SIDEBAR_HIDDEN, hidden);
  }

  /** Gives the tree the keyboard, its cursor on the open chat (or its project, when that is closed). Shows a hidden sidebar. */
  focusTree() {
    if (this.sidebarHidden) this.setSidebarHidden(false);
    const project = this.chat(this.chatId).project;
    this.cursor = this.collapsed[project] ? `p:${project}` : `c:${this.chatId}`;
    this.zone = "tree";
    this.handle.focus();
    this.revealCursor();
  }

  /** Scrolls the sidebar so the cursor's row shows. */
  revealCursor() {
    const i = this.treeKeys.indexOf(this.cursor);
    if (i >= 0) this.treeScroll.scroll_to_item(i);
  }

  /** The messages shown after applying the profile setting. @param {any} chat */
  visibleThread(chat) { return visibleMessages(chat, this.condenseChat !== false); }

  chatMatches() {
    const query = this.chatSearchInput.value().trim().toLowerCase();
    if (!query) return [];
    return this.visibleThread(this.chat(this.chatId)).flatMap((m, index) => {
      const text = [m.text, m.title, ...(m.lines ?? []), ...(m.questions ?? []).map(q => q.question)].filter(Boolean).join("\n");
      return text.toLowerCase().includes(query) ? [index] : [];
    });
  }

  findChatMatch(direction) {
    const matches = this.chatMatches();
    if (!matches.length) { this.chatSearchIndex = 0; return; }
    this.chatSearchIndex = ((this.chatSearchIndex + direction) % matches.length + matches.length) % matches.length;
    this.atBottom = false;
    this.scroll.scroll_to_item(matches[this.chatSearchIndex]);
  }

  toggleChatSearch() {
    this.chatSearchOpen = !this.chatSearchOpen;
    if (this.chatSearchOpen) this.chatSearchInput.focus();
    else this.focusInput();
  }

  /** The open chat's message rows in order, by id, as the keys see them. */
  rowIds() {
    const chat = this.chat(this.chatId);
    const ids = this.visibleThread(chat).map((/** @type {any} */ m) => m.id);
    if (this.thinking(chat) && !this.needsYou(chat)) ids.push("typing");
    return ids;
  }

  /** Puts the newest message on screen, then corrects its position after changed rows are laid out. @param {any} [cx] */
  scrollDown(cx) {
    const n = this.rowIds().length;
    // The final direct child is a bottom marker, even when the last message is taller than the viewport.
    if (n > 0) this.scroll.scroll_to_item(n);
    this.atBottom = true;
    if (cx?.timer && !this.bottomScrollPending) {
      const chatId = this.chatId;
      this.bottomScrollPending = true;
      cx.timer.after(16, (cx) => {
        this.bottomScrollPending = false;
        if (this.chatId !== chatId || !this.atBottom) return;
        this.scrollDown();
        cx.notify();
      });
    }
  }

  /** Reapply bottom anchoring once a message's actual layout height is known. @param {string} key @param {number} height @param {any} cx */
  measureRow(key, height, cx) {
    if (this.rowHeights.get(key) === height) return;
    this.rowHeights.set(key, height);
    if (this.atBottom) { this.scrollDown(); cx.notify(); }
    this.settleRestore(cx);
  }

  /** Keep the tail visible after the composer or window changes height. @param {number} height @param {any} cx */
  measureViewport(height, cx) {
    if (this.viewH === height) return;
    this.viewH = height;
    if (this.atBottom) { this.scrollDown(); cx.notify(); }
    this.settleRestore(cx);
  }

  /** Keep the cover until layout stays stable through the final scroll. @param {any} cx */
  settleRestore(cx) {
    const restore = this.restoring;
    if (!restore || restore.pending) return;
    ++restore.version;
    if (restore.scheduled) return;
    restore.scheduled = true;
    let version = restore.version;
    let frames = 0;
    const settle = (cx) => {
      if (this.restoring !== restore) return;
      if (restore.version !== version && ++frames < 8) {
        version = restore.version;
        cx.timer.after(32, settle);
        return;
      }
      this.scrollDown();
      cx.notify();
      version = restore.version;
      // Timer callbacks must use their own context. Layout's context expires on return.
      cx.timer.after(32, (cx) => {
        if (this.restoring !== restore) return;
        // A post-scroll measurement can change the viewport again. Keep that correction covered.
        if (restore.version !== version && ++frames < 8) {
          version = restore.version;
          settle(cx);
          return;
        }
        this.restoring = null;
        cx.notify();
      });
    };
    cx.timer.after(32, settle);
  }

  /** Track manual scrolling so following resumes when the user returns to the bottom. @param {number} dy */
  trackMessageScroll(dy) {
    const height = this.rowIds().reduce((sum, id) => sum + (this.rowHeights.get(id) ?? 0), 0);
    const max = Math.max(0, LIST_PAD_TOP + height + LIST_PAD_BOTTOM + 1 - this.viewH);
    this.top = Math.max(0, Math.min(max, (this.atBottom ? max : this.top) - dy));
    this.atBottom = this.top >= max - 1;
  }

  /** Opens a chat and gives its message box the keyboard. @param {string} id @param {any} cx */
  openChat(id, cx) {
    if (this.restoring && this.restoring.id !== id) this.restoring = null;
    this.chatSearchOpen = false;
    this.chatSearchIndex = 0;
    this.chatSearchInput?.set_value("");
    this.modelPicker = null;
    this.outputPreview = null;
    this.outputError = null;
    // A new chat you never wrote in goes away when you leave it.
    this.chats = this.chats.filter((c) => c.id === id || c.session || c.thread.length > 0);
    this.chatId = id;
    if (this.loaded) this.saveChats();
    this.cursor = `c:${id}`;
    this.unread = { ...this.unread, [id]: false };
    const chat = this.chat(id);
    if (!this.bridges.has(id) && chat.session) {
      // A running bridge replays its part (link reads the file for the rest). Otherwise the
      // history comes from the session file.
      cx.spawn(async (cx) => {
        try {
          const bridge = await this.link(chat, cx, false);
          if (!bridge && chat.thread.length === 0 && !chat.loading) await this.loadHistory(chat, 0, cx);
        } finally {
          if (this.restoring?.id === id) {
            this.restoring.pending = false;
            this.settleRestore(cx);
          }
        }
      });
    }
    this.scrollDown();
    this.focusInput();
  }

  /** @param {string} project */
  toggleProject(project) {
    this.setCollapsed(project, !this.collapsed[project]);
  }

  /** Opens or closes a project, and remembers it. @param {string} project @param {boolean} closed */
  setCollapsed(project, closed) {
    this.collapsed = { ...this.collapsed, [project]: closed };
    if (!checking()) setShared(COLLAPSED, this.collapsed);
  }

  /**
   * Opens a folder in its own chat tab, or focuses that project’s existing tab.
   * @param {any} cx
   */
  newProject(cx) {
    cx.spawn(async (cx) => {
      const picked = await pickProject();
      if (!picked) return;
      await toggle(cx, picked.cwd);
      cx.notify();
    });
  }

  /** Starts an empty chat in a project, with the agent of the chat that is open. @param {string} project @param {any} cx */
  newChat(project, cx) {
    const p = this.project(project);
    const id = `c${Date.now().toString(36)}`;
    const chat = { id, project, cwd: p?.cwd ?? "", agent: this.chats.find((c) => c.id === this.chatId)?.agent ?? "claude", title: "New chat", time: "Now", stamp: Date.now(), real: true, session: null, thread: [] };
    resetThread(chat);
    this.chats.push(chat);
    if (this.collapsed[project]) this.setCollapsed(project, false);
    this.openChat(id, cx);
  }

  // --- Talking to the agent ----------------------------------------------------------------------

  /**
   * Links a real chat to its bridge: replays what the bridge has, then follows it. With `launch`
   * the bridge is started when it isn't running; without, a chat whose bridge is gone stays as it is.
   * Resolves once the link is open (or failed).
   * @param {any} chat @param {any} cx @param {boolean} launch
   * @returns {Promise<Bridge | null>}
   */
  link(chat, cx, launch) {
    const pending = this.links.get(chat.id);
    if (pending) return pending.then((bridge) => bridge || (launch ? this.link(chat, cx, true) : null));
    const had = this.bridges.get(chat.id);
    if (had?.sock) return Promise.resolve(had);
    const connecting = new Promise((resolve) => {
      const bridge = new Bridge({ chat: chat.id, agent: chat.agent, cwd: chat.cwd, session: chat.session ?? null, model: chat.selectedModel ?? null },
        (ev, cx) => this.onEvent(chat, ev, cx),
        (cx) => { if (this.bridges.get(chat.id) === bridge) this.bridges.delete(chat.id); chat.working = false; cx.notify(); });
      this.bridges.set(chat.id, bridge);
      cx.spawn(async (cx) => {
        try {
          // A running bridge replays everything, so the chat is rebuilt from it. A new one only
          // has what comes next, so what the chat already shows stays.
          const running = await bridge.running();
          if (!launch && !running) { this.bridges.delete(chat.id); resolve(null); return; }
          if (running) { resetThread(chat); await this.loadHistory(chat, bridge.startedAt, cx); }
          const opened = bridge.open(cx);
          // open() reads until the link drops; it is linked once the socket exists.
          for (let i = 0; i < 100 && !bridge.sock && this.bridges.get(chat.id) === bridge; i++) await new Promise((d) => cx.timer.after(50, d));
          resolve(bridge.sock ? bridge : null);
          await opened;
        } catch (e) {
          this.bridges.delete(chat.id);
          chat.thread.push({ id: `x${chat.thread.length}`, kind: "error", from: "agent", text: e instanceof Error ? e.message : String(e) });
          chat.connecting = false;
          resolve(null);
          cx.notify();
        }
      });
    });
    const linked = connecting.finally(() => this.links.delete(chat.id));
    this.links.set(chat.id, linked);
    return linked;
  }

  /** Opens the active agent's model picker. @param {any} cx */
  toggleModels(cx) {
    const chat = this.chat(this.chatId);
    if (this.modelPicker === chat.id) { this.modelPicker = null; return; }
    this.modelPicker = chat.id;
    if (!chat.models) this.loadModels(chat, cx);
  }

  /** @param {any} chat @param {any} cx */
  loadModels(chat, cx) {
    if (chat.modelsLoading) return;
    const agent = chat.agent;
    chat.modelsLoading = true;
    chat.modelsError = null;
    cx.spawn(async (cx) => {
      try {
        const models = await listModels(agent, chat.cwd);
        if (chat.agent === agent) chat.models = models;
      } catch (e) { if (chat.agent === agent) chat.modelsError = e instanceof Error ? e.message : String(e); }
      finally { if (chat.agent === agent) chat.modelsLoading = false; cx.notify(); }
    });
  }

  /** Switches an idle conversation, releasing its writer before the next agent starts. @param {string} model @param {any} cx */
  chooseModel(model, cx) {
    const chat = this.chat(this.chatId);
    if (this.busy(chat) || this.needsYou(chat) || !chat.models?.some((m) => m.id === model)) return;
    if (model === (chat.selectedModel ?? chat.model)) { this.modelPicker = null; return; }
    chat.modelSaving = true;
    chat.modelsError = null;
    cx.spawn(async (cx) => {
      try {
        const bridge = this.bridges.get(chat.id) ?? new Bridge({ chat: chat.id, agent: chat.agent, cwd: chat.cwd, session: chat.session ?? null }, () => {}, () => {});
        await bridge.quit();
        bridge.close();
        this.bridges.delete(chat.id);
        chat.selectedModel = model;
        chat.model = model;
        chat.disconnected = false;
        chat.reconnecting = false;
        this.saveChats();
        this.modelPicker = null;
      } catch (e) { chat.modelsError = e instanceof Error ? e.message : String(e); }
      finally { chat.modelSaving = false; cx.notify(); }
    });
  }

  /** One event from a chat's bridge. @param {any} chat @param {any} ev @param {any} cx */
  onEvent(chat, ev, cx) {
    const before = chat.session;
    const beforeModel = chat.model;
    const what = applyEvent(chat, ev);
    if (["turn_end", "tool_done", "user"].includes(ev.type)) this.syncOutputs(chat, cx);
    if (ev.type === "connection") {
      const recovery = {};
      chat.recovery = recovery;
      chat.connectionSlow = false;
      if (chat.reconnecting) cx.timer.after(1000, (cx) => {
        if (chat.recovery !== recovery || !chat.reconnecting) return;
        chat.connectionSlow = true;
        cx.notify();
      });
    }
    if (ev.type === "user" || ev.type === "text") chat.stamp = Math.max(chat.stamp ?? 0, Date.now() - 1);
    if (chat.session !== before || chat.model !== beforeModel) this.saveChats();
    const open = chat.id === this.chatId;
    if (what === "asked" || what === "question") {
      // A question leaves the keyboard in the message box, for typing your own answer.
      if (open) { if (what === "asked") { this.zone = "ask"; this.handle.focus(); } else this.focusInput(); }
      // The pane isn't in front: a sound, like Herdr's own "needs you".
      if (!panes().some((p) => p.mod === "hey-chat" && p.focused)) playSound("blocked");
    }
    if (what === "ended" && !open) this.unread = { ...this.unread, [chat.id]: true };
    if (what === "ended" && open && this.zone === "ask") this.focusInput();
    if (open && this.atBottom && ev.type !== "connection") this.scrollDown(cx);
    cx.notify();
  }

  /**
   * Adds the clipboard's image (or the image file whose path was pasted) to the open chat's next
   * message, or says why it can't.
   * @param {any} cx @param {string | null} [file]
   */
  pasteImage(cx, file = null) {
    const chat = this.chat(this.chatId);
    if (!chat) return;
    cx.spawn(async (cx) => {
      const r = await pasteImage(file);
      if ("error" in r) chat.pasteError = r.error;
      else { chat.pasteError = null; chat.attached = [...(chat.attached ?? []).filter((i) => i.path !== r.path), r]; }
      cx.notify();
    });
  }

  /**
   * Messages and Finder copy an image as its file's path. When that path lands in the box from the
   * clipboard, it comes back out and the image goes with the next message instead.
   * @param {any} box @param {any} cx
   */
  pastedPath(box, cx) {
    const clip = String(cx.read_from_clipboard?.() ?? "").trim();
    if (!/^(\/|~\/)[^\n]*\.(png|jpe?g|gif|webp)$/i.test(clip)) return;
    const text = box.value();
    if (!text.includes(clip)) return;
    box.set_value(text.replace(clip, "").replace(/^\s+$/, ""));
    this.pasteImage(cx, clip);
  }

  /**
   * Adds images dropped on the chat to its next message, in the order dropped. Files that aren't
   * images are left out, and the strip above the box says so.
   * @param {string[]} paths @param {any} cx
   */
  dropImages(paths, cx) {
    const chat = this.chat(this.chatId);
    if (!chat) return;
    cx.spawn(async (cx) => {
      const errors = [];
      for (const file of paths) {
        const r = /\.(png|jpe?g|gif|webp)$/i.test(file) ? await imageFile(file) : { error: "Only images can be dropped here." };
        if ("error" in r) { errors.push(r.error); continue; }
        chat.attached = [...(chat.attached ?? []).filter((i) => i.path !== r.path), r];
        cx.notify();
      }
      chat.pasteError = errors[0] ?? null;
      this.focusInput();
      cx.notify();
    });
  }

  /** Takes an image back out of the next message. @param {string} path */
  unattach(path) {
    const chat = this.chat(this.chatId);
    if (chat) chat.attached = (chat.attached ?? []).filter((i) => i.path !== path);
  }

  // --- The / menu and compacting -------------------------------------------------------------------

  /** Compact first, then the skills the chat's agent has loaded in its folder. */
  slashCommands() {
    const chat = this.chat(this.chatId);
    if (!chat) return [];
    const compact = { name: "compact", description: "Shorten this chat's history so it has room to keep going." };
    const got = this.skillLists.get(`${chat.agent}\n${chat.cwd}`);
    return [compact, ...(got?.list ?? [])];
  }

  /** True while the open chat's skills are still being looked up. */
  skillsLoading() {
    const chat = this.chat(this.chatId);
    return Boolean(chat && this.skillLists.get(`${chat.agent}\n${chat.cwd}`)?.loading);
  }

  /**
   * The / menu's rows for what's in the box: a / and the start of a name, nothing after it.
   * Names starting with what you typed come first. Null when the menu is closed.
   */
  slashItems() {
    const chat = this.chat(this.chatId);
    if (!chat || this.zone !== "chat" || this.question(chat)) return null;
    const text = this.inputFor(chat.agent).value();
    const m = /^\/([^\s/]*)$/.exec(text);
    if (!m || this.slashClosed === text) return null;
    const q = m[1].toLowerCase();
    const all = this.slashCommands().filter((c) => c.name.toLowerCase().includes(q));
    return [...all.filter((c) => c.name.toLowerCase().startsWith(q)), ...all.filter((c) => !c.name.toLowerCase().startsWith(q))];
  }

  /** On each change in the box: starts the skills lookup at the first /, and lights the first row again. @param {any} cx */
  slashChanged(cx) {
    const chat = this.chat(this.chatId);
    if (!chat || this.question(chat)) return;
    const text = this.inputFor(chat.agent).value();
    if (!text.startsWith("/")) { this.slashClosed = null; return; }
    this.slashIndex = 0;
    const key = `${chat.agent}\n${chat.cwd}`;
    if (this.skillLists.has(key)) return;
    this.skillLists.set(key, { list: [], loading: true });
    cx.spawn(async (cx) => {
      const list = await listSkills(chat.agent, chat.cwd);
      this.skillLists.set(key, { list, loading: false });
      cx.notify();
    });
  }

  /** Moves the lit row. @param {number} step */
  moveSlash(step) {
    const n = this.slashItems()?.length ?? 0;
    if (n) this.slashIndex = (this.slashIndex + step + n) % n;
  }

  /** Closes the menu until the box changes. */
  closeSlash() {
    const chat = this.chat(this.chatId);
    if (chat) this.slashClosed = this.inputFor(chat.agent).value();
  }

  /** Puts a row's /name in the box, ready for what you add after it. @param {{ name: string }} item */
  pickSlash(item) {
    const chat = this.chat(this.chatId);
    if (!chat) return;
    const box = this.inputFor(chat.agent);
    const text = `/${item.name} `;
    box.set_value(text);
    box.set_selected_range({ start: text.length, end: text.length });
    this.slashIndex = 0;
    box.focus();
  }

  /**
   * The Codex skill a message starts with (/name), with the SKILL.md path Codex needs, or null.
   * @param {any} chat @param {string} text
   */
  codexSkill(chat, text) {
    const m = /^\/(\S+)/.exec(text);
    const found = m && this.skillLists.get(`${chat.agent}\n${chat.cwd}`)?.list.find((s) => s.name === m[1]);
    return found?.path ? { name: found.name, path: found.path } : null;
  }

  /**
   * Has the open chat's agent compact it: shorten its history so it has room to keep going.
   * A "Chat compacted." note shows when it's done.
   * @param {any} cx
   */
  compact(cx) {
    const chat = this.chat(this.chatId);
    if (!chat || this.busy(chat)) return;
    const note = (/** @type {string} */ text) => { chat.thread.push({ id: `x${chat.thread.length}`, kind: "note", text }); this.scrollDown(); };
    if (!chat.session) { note("Nothing to compact yet."); return; }
    const missing = this.missingCli(chat.agent);
    if (missing) { chat.thread.push({ id: `x${chat.thread.length}`, kind: "error", from: "agent", text: missing }); this.scrollDown(); return; }
    chat.connecting = true;
    this.scrollDown();
    cx.spawn(async (cx) => {
      const bridge = await this.link(chat, cx, true);
      chat.connecting = false;
      if (bridge) await bridge.compact().catch((e) => chat.thread.push({ id: `x${chat.thread.length}`, kind: "error", from: "agent", text: String(e?.message ?? e) }));
      cx.notify();
    });
  }

  /**
   * Sends the message box's text, and any images you pasted, to the chat's agent through its bridge.
   * @param {any} cx
   */
  send(cx) {
    const chat = this.chat(this.chatId);
    const box = this.inputFor(chat.agent);
    const text = box.value().trim();
    const images = chat.attached ?? [];
    // While the agent asks you something, what you type is your own answer to its next question.
    const asking = this.question(chat);
    if (asking && text) {
      const q = this.nextQuestion(asking) ?? asking.questions[asking.questions.length - 1];
      if (q) asking.picks = { ...asking.picks, [q.id]: [text] };
      box.set_value("");
      this.sendAnswers(asking, cx);
      cx.notify();
      return;
    }
    if ((!text && images.length === 0) || chat.connecting || chat.modelSaving || chat.reconnecting) return;
    const queued = Boolean(chat.working);
    // Existing bridges pick up the queue protocol on the next idle send, without interrupting a turn.
    if (queued && this.bridges.get(chat.id)?.protocol === 1) {
      chat.thread.push({ id: `x${chat.thread.length}`, kind: "error", from: "agent", text: "Queue support will be ready after this turn. Your draft is still here." });
      cx.notify();
      return;
    }
    if (queued && text === "/compact" && images.length === 0) return;
    if (text === "/compact" && images.length === 0) { box.set_value(""); this.compact(cx); return; }
    const missing = this.missingCli(chat.agent);
    if (missing) { chat.thread.push({ id: `x${chat.thread.length}`, kind: "error", from: "agent", text: missing }); this.scrollDown(); return; }
    const skill = chat.agent === "codex" ? this.codexSkill(chat, text) : null;
    box.set_value("");
    chat.attached = []; chat.pasteError = null;
    if (chat.thread.length === 0 && !chat.session) { const line = text.replace(/\s*\n\s*/g, " ") || "Image"; chat.title = line.length > 32 ? `${line.slice(0, 31)}…` : line; }
    chat.stamp = Date.now(); chat.time = clock(Date.now());
    this.saveChats();
    chat.connecting = !queued;
    this.scrollDown(cx);
    cx.spawn(async (cx) => {
      try {
        let bridge = await this.link(chat, cx, true);
        if (bridge?.protocol === 1 && !queued) {
          await bridge.quit();
          bridge.close();
          if (this.bridges.get(chat.id) === bridge) this.bridges.delete(chat.id);
          bridge = await this.link(chat, cx, true);
        }
        if (!bridge) throw new Error("Couldn't connect. Your message wasn't sent.");
        await bridge.send(text, images, skill, `${chat.id}-${Date.now()}-${this.messageSequence = (this.messageSequence ?? 0) + 1}`);
      } catch (e) {
        chat.thread.push({ id: `x${chat.thread.length}`, kind: "error", from: "agent", text: String(e?.message ?? e) });
        // Preserve both the failed message and anything typed while its write was in flight.
        const draft = box.value();
        box.set_value([text, draft].filter(Boolean).join("\n\n"));
        chat.attached = [...images, ...(chat.attached ?? [])].filter((img, n, all) => all.findIndex(x => x.path === img.path) === n);
      } finally {
        chat.connecting = false;
        if (this.chatId === chat.id && this.atBottom) this.scrollDown(cx);
      }
      cx.notify();
    });
  }

  /** Steers the active turn with a message already in the queue. @param {string} id @param {any} cx */
  sendQueuedNow(id, cx) {
    const chat = this.chat(this.chatId);
    const card = chat.thread.find(m => m.queueId === id && m.queueAction && m.queued);
    if (!card || card.sending) return;
    card.sending = true;
    card.queueError = null;
    cx.spawn(async (cx) => {
      try {
        const bridge = await this.link(chat, cx, false);
        if (!bridge) throw new Error("Not connected. Try Send now again.");
        await bridge.sendNow(id);
      } catch (e) { card.sending = false; card.queueError = String(e?.message ?? e); }
      cx.notify();
    });
  }

  /** Why a chat's agent can't run here, or null. @param {string} agent */
  /** @param {any} cx @param {boolean} [automatic] */
  refreshSetup(cx, automatic = false) {
    if (this.setupChecking) return;
    this.setupChecking = true;
    cx.spawn(async cx => {
      const previous = this.setupState;
      try {
        this.setupState = await checkSetup();
        const state = this.setupState;
        this.agents = [...(state.node ? ["node"] : []), ...Object.keys(state.agents).filter(a => state.agents[a].installed)];
        const ready = Object.keys(state.agents).find(a => state.agents[a].auth === "ready");
        if (automatic && !this.chat(this.chatId)?.session && !this.chat(this.chatId)?.thread.length) {
          if (ready) this.chat(this.chatId).agent = ready;
          else this.setupOpen = true;
        }
        if (previous?.node === false && state.node) await this.loadChats(cx);
      } finally { this.setupChecking = false; cx.notify(); }
    });
  }

  missingCli(agent) {
    if (!this.agents) return null;
    if (!this.agents.includes("node") || !this.agents.includes(agent)) { this.setupOpen = true; this.setupAgent = agent; }
    if (!this.agents.includes("node")) return "Hey, chat needs node on your PATH to run the agent.";
    if (!this.agents.includes(agent)) return `Hey, chat can't find the ${agent} command. Install it and sign in, then try again.`;
    return null;
  }

  /** Stops the open chat's turn. */
  stop() {
    const chat = this.chat(this.chatId);
    if (chat.real && chat.working) this.bridges.get(chat.id)?.stop().catch(() => null);
  }

  /**
   * Picks an option for one of a question card's questions. One question with one answer is
   * sent at once; otherwise the card waits for its Send button.
   * @param {any} card @param {any} q a question of the card @param {string} label @param {any} cx
   */
  pickAnswer(card, q, label, cx) {
    if (card.state !== "pending" || card.sending) return;
    const now = card.picks[q.id] ?? [];
    card.picks = { ...card.picks, [q.id]: q.multi ? (now.includes(label) ? now.filter((/** @type {string} */ x) => x !== label) : [...now, label]) : [label] };
    if (card.questions.length === 1 && !q.multi) this.sendAnswers(card, cx);
  }

  /** True when every question of a card has an answer. @param {any} card */
  answeredAll(card) {
    return card.questions.every((/** @type {any} */ q) => (card.picks[q.id] ?? []).length > 0);
  }

  /** The first question of a card without an answer yet. @param {any} card */
  nextQuestion(card) {
    return card.questions.find((/** @type {any} */ q) => !(card.picks[q.id] ?? []).length) ?? null;
  }

  /** Sends a question card's answers to the agent. @param {any} card @param {any} cx */
  sendAnswers(card, cx) {
    if (card.state !== "pending" || card.sending || !this.answeredAll(card)) return;
    const chat = this.chat(this.chatId);
    card.sending = true;
    card.error = null;
    cx.spawn(async (cx) => {
      try {
        const bridge = this.bridges.get(chat.id);
        if (!bridge) throw new Error("Not connected to the bridge. Reopen this chat to reconnect.");
        await bridge.answer(card.ask, card.picks);
        if (card.state === "pending") card.state = "answered";
      } catch (e) { card.error = String(e?.message ?? e); }
      card.sending = false;
      cx.notify();
    });
    cx.notify();
  }

  /** Dismisses a question card without answering. @param {any} card @param {any} cx */
  dismissQuestion(card, cx) {
    if (card.state !== "pending" || card.sending) return;
    const chat = this.chat(this.chatId);
    card.sending = true;
    card.error = null;
    cx.spawn(async (cx) => {
      try {
        const bridge = this.bridges.get(chat.id);
        if (!bridge) throw new Error("Not connected to the bridge. Reopen this chat to reconnect.");
        await bridge.decide(card.ask, "deny", false);
        if (card.state === "pending") card.state = "dismissed";
      } catch (e) { card.error = String(e?.message ?? e); }
      card.sending = false;
      cx.notify();
    });
    cx.notify();
  }

  decide(behavior, always, cx) {
    const chat = this.chat(this.chatId);
    const card = this.waiting(chat);
    if (!card) return;
    card.state = behavior === "allow" ? (always ? "always" : "allowed") : "denied";
    this.bridges.get(chat.id)?.decide(card.ask, behavior, always).catch(() => null);
    this.focusInput();
    cx.notify();
  }

  // --- Deleting ----------------------------------------------------------------------------------

  /** Asks whether to delete a chat (y / n). @param {string} id */
  askDelete(id) {
    if (!this.chats.some((c) => c.id === id)) return;
    // The question shows in the sidebar.
    if (this.sidebarHidden) this.setSidebarHidden(false);
    this.deleting = { id, back: this.zone === "tree" ? "tree" : "chat", busy: false, error: null };
    this.zone = "confirm";
    this.handle.focus();
  }

  /** Asks whether to delete every chat in a folder (y / n). The folder on disk is never touched. @param {string} project */
  askDeleteProject(project) {
    if (!this.projects.some((p) => p.id === project)) return;
    if (this.sidebarHidden) this.setSidebarHidden(false);
    this.deleting = { project, back: this.zone === "tree" ? "tree" : "chat", busy: false, error: null, done: 0 };
    this.zone = "confirm";
    this.handle.focus();
  }

  /** The chats a selection covers, from the anchor to the cursor in sidebar order. A chat in Recent and its folder counts once. */
  selectedIds() {
    if (!this.anchor) return [];
    const items = treeItemsOf(this);
    const a = items.indexOf(this.anchor), b = items.indexOf(this.cursor);
    if (a < 0 || b < 0) return [];
    const ids = items.slice(Math.min(a, b), Math.max(a, b) + 1).filter((k) => !k.startsWith("p:")).map((k) => k.slice(2));
    return [...new Set(ids)];
  }

  /** Asks whether to delete the selected chats (y / n). */
  askDeleteSelected() {
    const ids = this.selectedIds();
    if (ids.length === 0) return;
    if (ids.length === 1) { this.anchor = null; this.askDelete(ids[0]); return; }
    this.deleting = { ids, back: "tree", busy: false, error: null, done: 0 };
    this.zone = "confirm";
    this.handle.focus();
  }

  /** Puts the question away. */
  cancelDelete() {
    const back = this.deleting?.back;
    this.deleting = null;
    if (back === "tree") { this.zone = "tree"; this.handle.focus(); } else this.focusInput();
  }

  /** Stops the chat's agent before deleting its session. @param {any} chat */
  async removeChatSession(chat) {
    try {
      await this.links.get(chat.id);
      const bridge = this.bridges.get(chat.id) ?? new Bridge({ chat: chat.id, agent: chat.agent, cwd: chat.cwd, session: chat.session }, () => {}, () => {});
      await bridge.quit();
      bridge.close();
      this.bridges.delete(chat.id);
      return chat.session ? await deleteSession(chat.agent, chat.session, chat.file ?? null) : { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Deletes the confirmed chat and opens the next one. @param {any} cx */
  confirmDelete(cx) {
    const d = this.deleting;
    if (!d || d.busy) return;
    if (d.project || d.ids) { this.confirmDeleteMany(cx); return; }
    const chat = this.chats.find((c) => c.id === d.id);
    if (!chat) { this.cancelDelete(); return; }
    d.busy = true; d.error = null;
    cx.spawn(async (cx) => {
      const r = await this.removeChatSession(chat);
      if (!r.ok) { d.busy = false; d.error = r.message || "Couldn't delete it."; cx.notify(); return; }
      this.chats = this.chats.filter((c) => c.id !== chat.id);
      this.saveChats();
      const back = d.back;
      this.deleting = null;
      if (this.chatId === chat.id) {
        const next = this.chatsIn(chat.project)[0];
        if (next) this.openChat(next.id, cx); else this.newChat(chat.project, cx);
      }
      if (back === "tree") this.focusTree(); else this.focusInput();
      cx.notify();
    });
  }

  /**
   * Deletes several chats one at a time, as deleting one chat does: every chat in a folder (the
   * folder then leaves the sidebar), or the selected chats. A chat that can't be deleted stays,
   * and the question shows why.
   * @param {any} cx
   */
  confirmDeleteMany(cx) {
    const d = this.deleting;
    const chats = d.project ? this.chats.filter((c) => c.project === d.project) : this.chats.filter((c) => d.ids.includes(c.id));
    d.busy = true; d.error = null; d.done = 0; d.total = chats.length;
    cx.spawn(async (cx) => {
      /** @type {string[]} */
      const failed = [];
      for (const chat of chats) {
        const r = await this.removeChatSession(chat);
        if (!r.ok) { failed.push(`${chat.title}: ${r.message || "couldn't delete it"}`); continue; }
        this.chats = this.chats.filter((c) => c.id !== chat.id);
        d.done += 1;
        cx.notify();
      }
      this.saveChats();
      this.anchor = null;
      if (failed.length > 0) { d.busy = false; d.error = failed.slice(0, 3).join("\n"); cx.notify(); return; }
      if (d.project) {
        this.projects = this.projects.filter((p) => p.id !== d.project);
        const { [d.project]: _gone, ...rest } = this.collapsed;
        this.collapsed = rest;
        if (!checking()) setShared(COLLAPSED, this.collapsed);
        this.saveChats(); // again, now that a project you made is gone too
      }
      const back = d.back;
      this.deleting = null;
      if (!this.chats.some((c) => c.id === this.chatId)) {
        const next = this.chats.slice().sort((a, b) => b.stamp - a.stamp)[0];
        if (next) this.openChat(next.id, cx);
        else { const id = this.addProject(this.folder ?? home()); this.newChat(id, cx); }
      }
      if (back === "tree") this.focusTree(); else this.focusInput();
      cx.notify();
    });
  }

  // --- Settings ----------------------------------------------------------------------------------

  /** Shows only conversation and file edits, and remembers the setting. */
  toggleCondenseChat() {
    this.condenseChat = !this.condenseChat;
    if (!checking()) setShared(CONDENSE_CHAT, this.condenseChat);
    this.scrollDown();
  }

  /** Shows or hides the key hints (Settings), and remembers it. */
  toggleKeyHints() {
    this.keyHints = !this.keyHints;
    if (!checking()) setShared(KEY_HINTS, this.keyHints);
  }

  /** Opens or closes the Settings card. */
  toggleSettings() {
    if (this.settingsOpen) this.closeSettings();
    else { this.settingsOpen = true; this.photoError = null; }
  }

  /** Closes the Settings card and gives the message box the keyboard back. */
  closeSettings() {
    this.settingsOpen = false;
    this.focusInput();
  }

  /** Your picture: a built-in one's path, or null for initials. @param {string | null} picture */
  setPicture(picture) {
    const old = this.me.picture;
    this.me = { ...this.me, picture };
    this.photoError = null;
    saveMe(this.me);
    if (old !== picture) dropPhoto(old);
  }

  /** @param {string} color */
  setColor(color) {
    this.me = { ...this.me, color };
    saveMe(this.me);
  }

  /** Asks for a photo with the system's file dialog and uses it. @param {any} cx */
  uploadPhoto(cx) {
    if (this.photoBusy) return;
    cx.spawn(async (cx) => {
      const path = await pickPhoto();
      if (path) await this.importPhoto(path, cx);
      else if (window().platform === "windows") { this.photoError = "Drop a picture on this card to use it."; cx.notify(); }
    });
  }

  /** Uses a dropped file as your photo. @param {string | undefined} path @param {any} cx */
  usePhoto(path, cx) {
    if (!path || this.photoBusy) return;
    cx.spawn(async (cx) => { await this.importPhoto(path, cx); });
  }

  /** Copies a photo in (me.js importPhoto) and makes it your picture. @param {string} path @param {any} cx */
  async importPhoto(path, cx) {
    this.photoBusy = true; this.photoError = null; cx.notify();
    try {
      const picture = await importPhoto(path, this.me.picture);
      this.me = { ...this.me, picture };
      saveMe(this.me);
    } catch (e) {
      this.photoError = e instanceof Error ? e.message : "Couldn't use that picture.";
    }
    this.photoBusy = false;
    cx.notify();
  }

  /** Discover outputs after a tool or turn finishes, rather than on every render. */
  syncOutputs(chat, cx) {
    const outputs = collectOutputs(chat, home());
    if (JSON.stringify(outputs) === JSON.stringify(chat.outputs ?? [])) return;
    chat.outputs = outputs;
    if (cx && this.outputsOpen && this.chatId === chat.id && chat.outputKey) this.selectOutput(chat.outputKey, cx);
    if (this.loaded) this.saveChats();
  }

  toggleOutputs(cx) {
    this.outputsOpen = !this.outputsOpen;
    if (!this.outputsOpen) return;
    const chat = this.chat(this.chatId);
    this.syncOutputs(chat, cx);
    const first = (chat.outputs ?? []).find(o => o.key === chat.outputKey) ?? chat.outputs?.[0];
    if (first) this.selectOutput(first.key, cx);
  }

  addOutputLink(cx) {
    const chat = this.chat(this.chatId);
    const output = webOutput((cx.read_from_clipboard() ?? "").trim());
    if (!output) { this.outputError = "Copy an http or https link first, then try again."; return; }
    chat.outputs = [...(chat.outputs ?? []).filter(o => o.key !== output.key), { ...output, updated: Date.now(), message: "attached" }];
    this.outputError = null;
    this.saveChats();
    this.selectOutput(output.key, cx);
  }

  selectOutput(key, cx) {
    const chat = this.chat(this.chatId);
    const output = chat.outputs?.find(o => o.key === key);
    if (!output) return;
    chat.outputKey = key;
    this.outputError = null;
    this.outputPreview = null;
    if (output.kind === "link") return;
    const request = {};
    this.outputRequest = request;
    cx.spawn(async cx => {
      let preview;
      try {
        preview = output.kind === "image" ? { ...await imageFile(output.target), kind: "image" } : await outputFileAction("read", output.target);
      } catch (error) { preview = { error: "Couldn't read this file. It may have moved or been deleted." }; }
      if (this.outputRequest !== request || this.chatId !== chat.id || chat.outputKey !== key) return;
      this.outputPreview = { ...preview, key, chat: chat.id, version: Date.now() };
      cx.notify();
    });
  }

  openOutput(action, cx) {
    const chat = this.chat(this.chatId);
    const output = chat.outputs?.find(o => o.key === chat.outputKey);
    if (!output) return;
    if (output.kind === "link") { cx.open_url(output.target); return; }
    cx.spawn(async cx => {
      try { await outputFileAction(action, output.target); }
      catch (error) { if (this.chatId === chat.id) this.outputError = error instanceof Error ? error.message : "Couldn't open this output."; }
      cx.notify();
    });
  }

  render(_cx) {
    if (this.launcher) return h_flex();
    const t = colors();
    if (this.setupOpen) return h_flex().size_full().p(GAP).bg(paneBackground(theme().background))
      .track_focus(this.handle)
      .on_key_down((e, cx) => { if (e.keystroke === "escape") { this.setupOpen = false; this.focusInput(); cx.notify(); } })
      .child(setupView(this, t));
    const wide = this.width >= 1100;
    const outputOverlay = this.width < 800;
    const showTree = !this.sidebarHidden && (!this.outputsOpen || wide);
    const chatWidth = Math.max(0, this.width - GAP * 2 - (showTree ? TREE_WIDTH + GAP : 0) - (this.outputsOpen && !outputOverlay ? OUTPUTS_WIDTH + GAP : 0));
    return h_flex().id("root").relative().size_full().p(GAP).gap(GAP).bg(paneBackground(theme().background))
      .track_focus(this.handle)
      .on_key_down((e, cx) => handleKey(this, e, cx))
      .on_size_change((size, cx) => { this.width = size.width; this.height = size.height; cx.notify(); })
      .when(showTree, (el) => el.child(treeView(this, t)))
      .child(chatView(this, t, chatWidth))
      .when(this.outputsOpen, el => el.child(outputsView(this, t).when(outputOverlay, panel => panel.absolute().top(GAP).right(GAP).w(Math.max(1, Math.min(OUTPUTS_WIDTH, this.width - GAP * 2))).h(Math.max(1, this.height - GAP * 2)))))
      .when(Boolean(this.viewing), (el) => el.child(imageViewer(this)));
  }
}
