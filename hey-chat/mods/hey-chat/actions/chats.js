// The view's projects and chats: finding them, loading them, opening them and starting new ones.
// Like every file in actions/, this is a set of the view's methods (main.js adds them to it), so
// `this` is the view.
import { InputState } from "gpui-base";
import { shared, setShared, home } from "herdr";
import { AGENTS } from "../pictures.js";
import { listSessions, readSession, listLinkedChats } from "../agent.js";
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
    // Listing every session takes about a second. The chats saved here don't wait for it: their
    // bridges start replaying at once, and a session file is read once the list says where it is.
    const listing = listSessions();
    const linkedListing = listLinkedChats().catch(error => { this.linksError = errorText(error); return []; });
    /** @type {(value?: any) => void} */
    let listed = () => {};
    this.sessionsListed = new Promise((resolve) => { listed = resolve; });
    const [s, linked] = await Promise.all([loadStore(), linkedListing]);
    this.rememberDeletedChats(linked);
    for (const p of s.projects) {
      if (!p?.path || (this.folder && expand(p.path) !== this.folder)) continue;
      const id = this.addProject(expand(p.path), p.id);
      if (p.made) { const made = this.project(id); if (made) made.made = true; }
    }
    for (const c of s.chats) {
      if (this.isDeletedChat(c)) continue;
      if (c?.cwd) c.cwd = c.cwd.replace(/\\/g, "/");
      if ((this.folder && c.cwd !== this.folder) || !c?.id || (!c.session && !c.draft && !c.attached?.length && !c.pinned && !c.customTitle && !c.parentId && !c.linkId) || this.chats.some((x) => x.id === c.id)) continue;
      const chat = { ...c, cwd: String(c.cwd ?? ""), project: this.addProject(String(c.cwd ?? ""), c.project), real: true, thread: [] };
      resetThread(chat);
      this.chats.push(chat);
    }
    for (const record of linked) this.adoptLinkedChat(record);
    this.linkAll(cx);
    const sessions = await listing;
    for (const x of sessions) {
      if (this.isDeletedChat(x)) continue;
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
    listed();
    // Do not replace a conversation the user chose, or started typing in, while sessions were loading.
    const startup = this.chat(initialChat);
    const untouched = startup && !startup.pinned && !startup.customTitle && !this.renaming && !this.busy(startup) && !startup.session && !startup.thread.length && !startup.attached?.length && !this.inputFor(startup.agent).value();
    const active = this.visibleProjects().flatMap(p => this.chatsIn(p.id))
      .find(c => c.id !== initialChat && (this.chatDepth?.[c.id] ?? 0) === 0)?.id;
    if (this.chatId === initialChat && untouched && active) {
      this.restoring = { id: active, pending: true, version: 0 };
      this.openChat(active, cx);
      const restored = this.chat(this.chatId);
      this.setCollapsed(restored.project, false);
    }
    this.loaded = true;
    this.starting = false;
    this.saveChats();
    this.linkAll(cx);
    cx.notify();
  },

  /**
   * Links each chat with a session that isn't linked or linking yet. A running bridge replays its
   * chat, which changes the sidebar many times over. The sidebar shows "Syncing chats…" until each
   * one is done: no bridge, its replay ended, or its link closed.
   * @param {any} cx
   */
  linkAll(cx) {
    for (const c of this.chats) if ((c.session || c.linkId) && !c.linkTried && !this.bridges.has(c.id) && !this.links?.has(c.id)) {
      c.linkTried = true;
      this.syncing.add(c.id);
      const linking = this.link(c, cx, false);
      cx.spawn(async (/** @type {any} */ cx) => { if (!(await linking) && this.syncing.delete(c.id)) cx.notify(); });
    }
  },

  /** True while the sidebar waits: the sessions aren't listed yet, or a chat is still syncing. */
  treeSyncing() {
    return !this.loaded || this.syncing.size > 0;
  },

  /**
   * Shows a chat's history from its session file: what came before `before` (when a bridge
   * replays the rest), or the full saved conversation.
   * @param {any} chat @param {number} before @param {any} cx
   */
  async loadHistory(chat, before, cx) {
    // A chat saved before its session file's place was kept learns it from the session list.
    if (!chat.file) await this.sessionsListed;
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

  /** Moves this conversation's draft when its agent changes, replacing the other box's old text. */
  setChatAgent(chat, agent) {
    const open = chat.id === this.chatId;
    if (open) this.captureDraft();
    chat.agent = agent;
    if (open) this.inputFor(agent).set_value(chat.draft ?? "");
    this.saveChats();
  },

  /** Keeps the open composer with its conversation, including before a save or close. */
  captureDraft() {
    const chat = this.chats?.find(c => c.id === this.chatId);
    if (chat && this.inputs) chat.draft = this.inputFor(chat.agent).value();
  },

  /** Saves typing after a short pause. Switching or closing saves immediately. */
  draftChanged(cx) {
    this.captureDraft();
    const version = this.draftVersion = (this.draftVersion ?? 0) + 1;
    cx.timer.after(250, () => {
      if (this.draftVersion === version && this.loaded) this.saveChats();
    });
  },

  /** Saves conversations and unfinished messages. */
  saveChats() {
    this.captureDraft();
    if (this.quick || this.loaded === false) return Promise.resolve();
    return saveStore(this.chats, this.projects, this.chatId, this.folder).catch(e => console.error("Hey, chat couldn't save its conversations:", e));
  },

  /** @param {string} id */
  chat(id) { return this.chats.find((c) => c.id === id) ?? this.chats[0]; },

  /** Linked children share the normal list, keyboard order, search and pin sorting. */
  chatsIn(project) {
    const all = this.chats.filter(c => c.project === project).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.stamp ?? 0) - (a.stamp ?? 0));
    const identity = c => c.linkId ?? c.id;
    const byId = new Map(all.map(c => [identity(c), c]));
    const shown = new Set();
    if (this.query) for (const chat of all) {
      if (!`${chat.title} ${chat.last ?? ""} ${chat.project}`.toLowerCase().includes(this.query)) continue;
      let current = chat;
      while (current && !shown.has(current.id)) { shown.add(current.id); current = byId.get(current.parentId); }
    }
    const result = [], visited = new Set();
    this.chatDepth ??= {};
    const visit = (chat, depth) => {
      if (visited.has(chat.id)) return;
      visited.add(chat.id);
      if (this.query && !shown.has(chat.id)) return;
      result.push(chat); this.chatDepth[chat.id] = depth;
      if (!this.query && this.collapsed?.[`chat:${chat.id}`]) return;
      for (const child of all) if (child.parentId === identity(chat)) visit(child, depth + 1);
    };
    for (const chat of all) if (!chat.parentId || !byId.has(chat.parentId)) visit(chat, 0);
    for (const chat of all) if (!visited.has(chat.id) && (!chat.parentId || !byId.has(chat.parentId))) visit(chat, 0);
    return result;
  },

  /** Imports backend-created children into the existing view rather than creating another chat UI. */
  adoptLinkedChat(record, cx) {
    if (!record?.id || this.isDeletedChat(record) || (this.folder && record.cwd !== this.folder)) return null;
    let chat = this.chats.find(c => c.id === record.id || c.linkId === record.id || (record.session && c.session === record.session));
    if (!chat) {
      chat = { id: record.id, cwd: record.cwd, project: this.addProject(record.cwd), agent: record.agent,
        title: record.title, selectedModel: record.selectedModel, session: record.session ?? null,
        stamp: record.updatedAt ?? record.createdAt, time: shortWhen(record.updatedAt ?? record.createdAt), real: true, thread: [] };
      resetThread(chat); this.chats.push(chat);
    }
    chat.linkId = record.id;
    chat.parentId = record.parentId ?? null;
    chat.linkSummary = { summary: record.summary, status: record.status, attention: record.attention ?? [], lastResponse: record.lastResponse,
      stale: !record.summary || (record.summary.cursor ?? 0) < (record.lastInputSeq ?? 0), cursor: record.eventSeq ?? 0, reportError: record.reportError };
    if (!chat.customTitle) chat.title = record.title;
    if (record.session && !chat.session) chat.session = record.session;
    if (cx && !this.bridges.has(chat.id)) this.link(chat, cx, false);
    return chat;
  },

  async refreshLinkedChats(cx) {
    try {
      const records = await listLinkedChats();
      this.rememberDeletedChats(records);
      const removedActive = this.chats.some(chat => chat.id === this.chatId && this.isDeletedChat(chat));
      this.chats = this.chats.filter(chat => {
        if (!this.isDeletedChat(chat)) return true;
        this.bridges.get(chat.id)?.close();
        this.bridges.delete(chat.id);
        this.syncing?.delete(chat.id);
        return false;
      });
      for (const record of records) this.adoptLinkedChat(record, cx);
      if (removedActive) {
        const next = this.chatsIn(this.chats[0]?.project)[0] ?? this.chats[0];
        if (next) this.openChat(next.id, cx);
        else this.newChat(this.addProject(this.folder ?? home()), cx);
      }
      this.linksError = null;
      this.saveChats();
    } catch (error) { this.linksError = errorText(error); }
    cx.notify();
  },

  rememberDeletedChats(records) {
    this.deletedLinkedChats ??= new Set();
    this.deletedSessions ??= new Set();
    for (const record of records) if (record.deleted) {
      this.deletedLinkedChats.add(record.id);
      if (record.session) this.deletedSessions.add(`${record.agent}:${record.session}`);
    }
  },

  isDeletedChat(chat) {
    return Boolean(chat?.deleted || this.deletedLinkedChats?.has(chat?.linkId ?? chat?.id)
      || (chat?.session && this.deletedSessions?.has(`${chat.agent}:${chat.session}`)));
  },

  openRelatedChat(id, cx) {
    const chat = this.chats.find(c => (c.linkId ?? c.id) === id);
    if (chat) this.openChat(chat.id, cx);
  },

  /** Islands requests reuse project tabs and the ordinary chat-switch draft behavior. */
  openRequestedChat(cx) {
    const request = shared("hey-chat.openRequest");
    if (!this.loaded || request?.cwd !== this.folder || !request?.nonce || request.nonce === this.openRequest) return;
    this.openRequest = request.nonce;
    setShared("hey-chat.openRequest", null);
    cx.spawn(async cx => {
      await this.refreshLinkedChats(cx);
      if (this.openRequest === request.nonce) this.openRelatedChat(request.id, cx);
      cx.notify();
    });
  },

  /** Renames this chat locally, keeping its agent session and draft intact. */
  beginRename(id) {
    const chat = this.chats.find(c => c.id === id);
    if (!chat) return;
    this.cancelRename();
    const box = InputState.new({ value: chat.title ?? "", placeholder: "Chat name" });
    box.on("focus", () => { this.zone = "rename"; });
    box.on("change", (_e, cx) => cx.notify());
    this.renaming = { id, box, error: null };
    this.zone = "rename";
    box.focus();
    box.set_selected_range({ start: 0, end: box.value().length });
  },

  saveRename() {
    const edit = this.renaming;
    if (!edit) return;
    const title = edit.box.value().replace(/\s+/g, " ").trim();
    if (!title || title.length > 120) {
      edit.error = title ? "Use a name with 120 characters or fewer." : "Enter a chat name.";
      return;
    }
    const chat = this.chats.find(c => c.id === edit.id);
    if (chat) {
      chat.title = title;
      chat.customTitle = true;
      this.bridges?.get(chat.id)?.updateLinkMetadata?.(title).catch(() => {});
      this.saveChats();
    }
    this.cancelRename();
  },

  cancelRename() {
    if (!this.renaming) return;
    this.renaming.box.release();
    this.renaming = null;
    this.focusInput();
  },

  /** Pinned chats stay above recent conversations within their project. */
  togglePin(id) {
    const chat = this.chats.find(c => c.id === id);
    if (!chat) return;
    chat.pinned = !chat.pinned;
    this.saveChats();
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
    this.cancelRename();
    this.cancelQueueEdit();
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
    this.chats = this.chats.filter((c) => c.id === id || c.session || c.thread.length > 0 || c.draft || c.attached?.length || c.pinned || c.customTitle || c.parentId || c.linkId);
    const wasOpen = this.chatId === id;
    if (!wasOpen) this.summaryFor = null;
    this.chatId = id;
    this.bridges.get(id)?.markSeen?.().catch(() => {});
    this.cursor = `c:${id}`;
    this.unread = { ...this.unread, [id]: false };
    const chat = this.chat(id);
    if (!wasOpen) this.inputFor(chat.agent).set_value(chat.draft ?? "");
    if (this.loaded) this.saveChats();
    if (chat.session || chat.linkId) {
      // A running bridge replays its part (link reads the file for the rest). Otherwise the
      // history comes from the session file.
      cx.spawn(async (cx) => {
        try {
          const bridge = this.links?.has(id) ? await this.links.get(id)
            : this.bridges.get(id) ?? (chat.linkTried ? null : await this.link(chat, cx, false));
          if (!bridge && chat.thread.length === 0 && !chat.loading) await this.loadHistory(chat, 0, cx);
        } finally {
          if (this.restoring?.id === id) {
            this.restoring.pending = false;
            this.settleRestore(cx);
          }
        }
      });
    } else if (this.restoring?.id === id) {
      this.restoring.pending = false;
      this.settleRestore(cx);
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
    const id = `c${Date.now().toString(36)}-${this.chatSequence = (this.chatSequence ?? 0) + 1}`;
    const chat = { id, project, cwd: p?.cwd ?? "", agent: this.chats.find((c) => c.id === this.chatId)?.agent ?? "claude", title: "New chat", time: "Now", stamp: Date.now(), real: true, session: null, thread: [] };
    resetThread(chat);
    this.chats.push(chat);
    if (this.collapsed[project]) this.setCollapsed(project, false);
    this.openChat(id, cx);
  },
};
