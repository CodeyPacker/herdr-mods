// The view's projects and chats: finding them, loading them, opening them and starting new ones.
// Like every file in actions/, this is a set of the view's methods (main.js adds them to it), so
// `this` is the view.
import { AGENTS } from "../pictures.js";
import { listSessions, readSession } from "../agent.js";
import { applyEvent, resetThread, pendingAsk, pendingQuestion, shortWhen } from "../messages.js";
import { loadStore, saveStore, expand, tilde } from "../store.js";
import { pickProject } from "../folders.js";
import { toggle } from "../tabs.js";
import { COLLAPSED, errorText, folderName, remember } from "../common.js";

export const chats = {
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
  },

  /** The projects the tree shows, the one with the newest chat first. While searching, only those with a match. */
  visibleProjects() {
    const newest = (/** @type {string} */ id) => Math.max(0, ...this.chatsIn(id).map((c) => c.stamp ?? 0));
    return this.projects.filter((p) => !this.query || this.chatsIn(p.id).length > 0)
      .sort((a, b) => newest(b.id) - newest(a.id));
  },

  /** True when a project shows its chats: opened, or holding a search match. @param {string} id */
  isOpen(id) { return Boolean(this.query) || !this.collapsed[id]; },

  /** @param {string} id */
  project(id) { return this.projects.find((p) => p.id === id) ?? null; },

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
    // Do not replace a conversation the user chose, or started typing in, while sessions were loading.
    const startup = this.chat(initialChat);
    const untouched = startup && !this.busy(startup) && !startup.session && !startup.thread.length && !this.inputFor(startup.agent).value();
    if (this.chatId === initialChat && untouched && this.chats.some(c => c.id === active)) {
      this.restoring = { id: active, pending: true, version: 0 };
      this.openChat(active, cx);
      const restored = this.chat(this.chatId);
      this.setCollapsed(restored.project, false);
    }
    this.loaded = true;
    this.starting = false;
    this.saveChats();
    // A running bridge replays its chat, which changes the sidebar many times over. The sidebar
    // shows "Syncing chats…" until each one is done: no bridge, its replay ended, or its link closed.
    for (const c of this.chats) if (c.session) {
      this.syncing.add(c.id);
      const linking = this.link(c, cx, false);
      cx.spawn(async (/** @type {any} */ cx) => { if (!(await linking) && this.syncing.delete(c.id)) cx.notify(); });
    }
    cx.notify();
  },

  /** True while the sidebar waits: the sessions aren't listed yet, or a chat is still syncing. */
  treeSyncing() {
    return !this.loaded || this.syncing.size > 0;
  },

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
  },

  /** Saves the real chats. */
  saveChats() { return saveStore(this.chats, this.projects, this.chatId, this.folder).catch(e => console.error("Hey, chat couldn't save its conversations:", e)); },

  /** @param {string} id */
  chat(id) { return this.chats.find((c) => c.id === id) ?? this.chats[0]; },

  /** A project's chats, newest first. While searching, only those whose title, last message or folder match. @param {string} project */
  chatsIn(project) {
    const q = this.query;
    return this.chats.filter((c) => c.project === project && (!q || `${c.title} ${c.last ?? ""} ${c.project}`.toLowerCase().includes(q)))
      .sort((a, b) => b.stamp - a.stamp);
  },

  /** The two chats with the newest messages, from any project. */
  recentIds() {
    return this.folder ? [] : this.chats.slice().sort((a, b) => b.stamp - a.stamp).slice(0, 2).map((c) => c.id);
  },

  /** True while a chat's agent works on your message: the typing dots and "Thinking…". @param {any} chat */
  busy(chat) {
    return this.thinking(chat) || Boolean(chat?.reconnecting || chat?.thread?.some(m => m.queued));
  },

  /** Connection recovery is not agent work and must not add a typing row. @param {any} chat */
  thinking(chat) { return Boolean(chat?.working || chat?.connecting || chat?.modelSaving); },

  /** The permission card a chat is waiting on you for, or null. @param {any} chat */
  waiting(chat) {
    return chat ? pendingAsk(chat) : null;
  },

  /** The question card a chat is waiting on you for, or null. @param {any} chat */
  question(chat) {
    return chat ? pendingQuestion(chat) : null;
  },

  /** True while a chat waits on you: a permission or a question. @param {any} chat */
  needsYou(chat) {
    return Boolean(this.waiting(chat) || this.question(chat));
  },

  /** Adds an error bubble to a chat. @param {any} chat @param {unknown} error */
  addError(chat, error) {
    chat.thread.push({ id: `x${chat.thread.length}`, kind: "error", from: "agent", text: errorText(error) });
  },

  /** The open chat's agent's name. */
  chatAgentName() { return AGENTS[this.chat(this.chatId).agent]?.name ?? "The agent"; },

  /** @param {string} agent */
  inputFor(agent) { return this.inputs[agent] ?? this.inputs.claude; },

  /**
   * Opens a chat and gives its message box the keyboard. The chat you leave keeps what you typed
   * in its box, and ⌃o goes back to it.
   * @param {string} id @param {any} cx
   */
  openChat(id, cx) {
    const leaving = this.chats.find((c) => c.id === this.chatId);
    if (leaving && leaving.id !== id) leaving.draft = this.inputFor(leaving.agent).value();
    this.noteVisit(this.chatId, id);
    if (this.restoring && this.restoring.id !== id) this.restoring = null;
    this.chatSearchOpen = false;
    this.chatSearchIndex = 0;
    this.chatSearchInput?.set_value("");
    this.modelPicker = null;
    this.outputPreview = null;
    this.outputError = null;
    // A new chat you never wrote in goes away when you leave it. One with a draft stays.
    this.chats = this.chats.filter((c) => c.id === id || c.session || c.thread.length > 0 || c.draft);
    const wasOpen = this.chatId === id;
    this.chatId = id;
    if (this.loaded) this.saveChats();
    this.cursor = `c:${id}`;
    this.unread = { ...this.unread, [id]: false };
    const chat = this.chat(id);
    if (!wasOpen) this.inputFor(chat.agent).set_value(chat.draft ?? "");
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
  },

  /** @param {string} project */
  toggleProject(project) {
    this.setCollapsed(project, !this.collapsed[project]);
  },

  /** Opens or closes a project, and remembers it. @param {string} project @param {boolean} closed */
  setCollapsed(project, closed) {
    this.collapsed = { ...this.collapsed, [project]: closed };
    remember(COLLAPSED, this.collapsed);
  },

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
  },

  /** Starts an empty chat in a project, with the agent of the chat that is open. @param {string} project @param {any} cx */
  newChat(project, cx) {
    const p = this.project(project);
    const id = `c${Date.now().toString(36)}`;
    const chat = { id, project, cwd: p?.cwd ?? "", agent: this.chats.find((c) => c.id === this.chatId)?.agent ?? "claude", title: "New chat", time: "Now", stamp: Date.now(), real: true, session: null, thread: [] };
    resetThread(chat);
    this.chats.push(chat);
    if (this.collapsed[project]) this.setCollapsed(project, false);
    this.openChat(id, cx);
  },
};
