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
import { h_flex, InputState, ScrollHandle } from "gpui-base";
import { nextCommand, panes, props, run, focused, closeOverlay, theme, window, playSound, checking, shared, setShared, home } from "herdr";
import { loadMe, saveMe, pickPhoto, importPhoto, dropPhoto } from "./me.js";
import { colors, paneBackground } from "./kit/theme.js";
import { AGENTS } from "./pictures.js";
import { Bridge, findAgents, listSessions, readSession, deleteSession } from "./agent.js";
import { applyEvent, resetThread, pendingAsk, clock, shortWhen } from "./messages.js";
import { loadStore, saveStore, expand, tilde } from "./store.js";
import { treeView, TREE_WIDTH } from "./views/tree.js";
import { chatView } from "./views/chat.js";
import { handleKey } from "./keys.js";

/** The space around and between the two cards. */
const GAP = 10;

/**
 * What the key (mod.open:hey-chat) does, in a tiny overlay copy that closes after: closes the
 * Hey, chat pane in the shown tab when there is one, otherwise opens one beside the focused pane
 * and zooms it to fill the tab (pane.zoom, so ctrl-shift-z gives the split back). The new pane
 * gets the focused terminal's folder, so that folder is a project in the tree.
 * @param {any} cx
 */
async function toggle(cx) {
  const f = focused();
  const tab = f?.tab;
  const open = panes().find((p) => p.mod === "hey-chat" && p.tab === tab);
  if (open) { run("pane.close", { pane: open.pane }); return; }
  run("pane.split", { direction: "right", mod: "hey-chat", props: f?.cwd ? { folder: f.cwd } : {} });
  // A command applies after run returns, so the new pane is looked for each frame (up to half a second).
  for (let i = 0; i < 30; i++) {
    const made = panes().find((p) => p.mod === "hey-chat" && p.tab === tab);
    if (made) { if (!made.zoomed) run("pane.zoom", { pane: made.pane }); return; }
    await new Promise((done) => cx.timer.after(16, done));
  }
}

/** Which projects are closed in the tree, kept across panes and restarts: { [project]: true }. */
const COLLAPSED = "hey-chat.collapsed";

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
    this.loaded = false;           // the sessions have been listed
    this.openTools = new Set();    // tool cards shown open
    /** @type {Map<string, Bridge>} each real chat's link to its bridge */
    this.bridges = new Map();
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
    // Where the keyboard is: "chat" (the message box), "tree", "search" (the tree's search box),
    // "settings" (the initials box), "ask" (a permission bar is waiting on y, a or n) or
    // "confirm" (the delete question is waiting on y or n).
    this.zone = "chat";
    this.cursor = "";              // the tree row j and k are on (keys.js treeItems)
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
      const box = InputState.new({ placeholder: `Message ${a.name}` });
      box.on("change", (_e, cx) => cx.notify());
      box.on("submit", (_e, cx) => { this.send(cx); cx.notify(); });
      box.on("focus", (_e, cx) => { this.zone = "chat"; cx.notify(); });
      this.inputs[id] = box;
    }
    this.handle = cx.focus_handle();
    cx.spawn(async (cx) => { for (;;) { this.command(await nextCommand(), cx); cx.notify(); } });
    // A new chat in the folder the pane was opened from, ready to type into. Your sessions fill
    // the tree around it once they're listed.
    const start = checking() ? home() : (props()?.folder ?? focused()?.cwd ?? home());
    const startId = this.addProject(start);
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
    cx.spawn(async (cx) => { this.agents = await findAgents(); cx.notify(); });
  }

  async close() {
    if (this.launcher) return;
    for (const b of this.bridges.values()) b.close();
    this.scroll.release(); this.treeScroll.release(); this.searchInput.release(); this.initialsInput.release();
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
    const [s, sessions] = await Promise.all([loadStore(), listSessions()]);
    for (const p of s.projects) if (p?.path) this.addProject(expand(p.path), p.id);
    for (const c of s.chats) {
      if (!c?.id || !c.session || this.chats.some((x) => x.id === c.id)) continue;
      const chat = { ...c, cwd: String(c.cwd ?? ""), project: this.addProject(String(c.cwd ?? ""), c.project), real: true, thread: [] };
      resetThread(chat);
      this.chats.push(chat);
    }
    for (const x of sessions) {
      const known = this.chats.find((c) => c.session === x.session);
      const facts = { file: x.file, last: x.last, lastFrom: x.lastFrom, stamp: Math.max(known?.stamp ?? 0, x.updatedAt), time: shortWhen(x.updatedAt) };
      if (known) { Object.assign(known, facts); continue; }
      const chat = { id: `${x.agent}-${x.session}`, project: this.addProject(x.cwd), cwd: x.cwd, agent: x.agent, title: x.title,
        session: x.session, real: true, thread: [], ...facts };
      resetThread(chat);
      this.chats.push(chat);
    }
    this.loaded = true;
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
    chat.working = false;
    chat.loading = false;
    if (chat.id === this.chatId) this.scrollDown();
    cx.notify();
  }

  /** Saves the real chats. */
  saveChats() { saveStore(this.chats, this.projects); }

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
    return this.chats.slice().sort((a, b) => b.stamp - a.stamp).slice(0, 2).map((c) => c.id);
  }

  /** True while a chat's agent works on your message: the typing dots and "Thinking…". @param {any} chat */
  busy(chat) {
    return Boolean(chat?.working || chat?.connecting);
  }

  /** The permission card a chat is waiting on you for, or null. @param {any} chat */
  waiting(chat) {
    return chat ? pendingAsk(chat) : null;
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

  /** Gives the tree the keyboard, its cursor on the open chat (or its project, when that is closed). */
  focusTree() {
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

  /** The open chat's message rows in order, by id, as the keys see them. */
  rowIds() {
    const chat = this.chat(this.chatId);
    const ids = chat.thread.map((/** @type {any} */ m) => m.id);
    if (this.busy(chat) && !this.waiting(chat)) ids.push("typing");
    return ids;
  }

  /** Puts the newest message on screen. */
  scrollDown() {
    const n = this.rowIds().length;
    if (n > 0) this.scroll.scroll_to_item(n - 1);
    this.atBottom = true;
  }

  /** Opens a chat and gives its message box the keyboard. @param {string} id @param {any} cx */
  openChat(id, cx) {
    // A new chat you never wrote in goes away when you leave it.
    this.chats = this.chats.filter((c) => c.id === id || c.session || c.thread.length > 0);
    this.chatId = id;
    this.cursor = `c:${id}`;
    this.unread = { ...this.unread, [id]: false };
    const chat = this.chat(id);
    if (!this.bridges.has(id) && chat.session) {
      // A running bridge replays its part (link reads the file for the rest). Otherwise the
      // history comes from the session file.
      cx.spawn(async (cx) => {
        const bridge = await this.link(chat, cx, false);
        if (!bridge && chat.thread.length === 0 && !chat.loading) await this.loadHistory(chat, 0, cx);
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
    const had = this.bridges.get(chat.id);
    if (had?.sock) return Promise.resolve(had);
    return new Promise((resolve) => {
      const bridge = new Bridge({ chat: chat.id, agent: chat.agent, cwd: chat.cwd, session: chat.session ?? null },
        (ev, cx) => this.onEvent(chat, ev, cx),
        (cx) => { this.bridges.delete(chat.id); chat.working = false; cx.notify(); });
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
  }

  /** One event from a chat's bridge. @param {any} chat @param {any} ev @param {any} cx */
  onEvent(chat, ev, cx) {
    const before = chat.session;
    const what = applyEvent(chat, ev);
    if (ev.type === "user" || ev.type === "text") chat.stamp = Math.max(chat.stamp ?? 0, Date.now() - 1);
    if (chat.session !== before) this.saveChats();
    const open = chat.id === this.chatId;
    if (what === "asked") {
      if (open) { this.zone = "ask"; this.handle.focus(); }
      // The pane isn't in front: a sound, like Herdr's own "needs you".
      if (!panes().some((p) => p.mod === "hey-chat" && p.focused)) playSound("blocked");
    }
    if (what === "ended" && !open) this.unread = { ...this.unread, [chat.id]: true };
    if (what === "ended" && open && this.zone === "ask") this.focusInput();
    if (open) this.scrollDown();
    cx.notify();
  }

  /**
   * Sends the message box's text to the chat's agent through its bridge.
   * @param {any} cx
   */
  send(cx) {
    const chat = this.chat(this.chatId);
    const box = this.inputFor(chat.agent);
    const text = box.value().trim();
    if (!text || this.busy(chat)) return;
    box.set_value("");
    if (chat.thread.length === 0 && !chat.session) chat.title = text.length > 32 ? `${text.slice(0, 31)}…` : text;
    chat.stamp = Date.now(); chat.time = clock(Date.now());
    this.saveChats();
    const missing = this.missingCli(chat.agent);
    if (missing) { chat.thread.push({ id: `x${chat.thread.length}`, kind: "error", from: "agent", text: missing }); this.scrollDown(); return; }
    chat.connecting = true;
    this.scrollDown();
    cx.spawn(async (cx) => {
      const bridge = await this.link(chat, cx, true);
      chat.connecting = false;
      if (bridge) await bridge.send(text).catch((e) => chat.thread.push({ id: `x${chat.thread.length}`, kind: "error", from: "agent", text: String(e?.message ?? e) }));
      cx.notify();
    });
  }

  /** Why a chat's agent can't run here, or null. @param {string} agent */
  missingCli(agent) {
    if (window().platform === "windows") return "Hey, chat can't run agents on Windows yet.";
    if (!this.agents) return null;
    if (!this.agents.includes("node")) return "Hey, chat needs node on your PATH to run the agent.";
    if (!this.agents.includes(agent)) return `Hey, chat can't find the ${agent} command. Install it and sign in, then try again.`;
    return null;
  }

  /** Stops the open chat's turn. */
  stop() {
    const chat = this.chat(this.chatId);
    if (chat.real && chat.working) this.bridges.get(chat.id)?.stop().catch(() => null);
  }

  /** Answers the permission card the open chat is waiting on. @param {"allow" | "deny"} behavior @param {boolean} always @param {any} cx */
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
    this.deleting = { id, back: this.zone === "tree" ? "tree" : "chat", busy: false, error: null };
    this.zone = "confirm";
    this.handle.focus();
  }

  /** Puts the question away. */
  cancelDelete() {
    const back = this.deleting?.back;
    this.deleting = null;
    if (back === "tree") { this.zone = "tree"; this.handle.focus(); } else this.focusInput();
  }

  /**
   * Deletes the chat the question is about: ends its bridge, removes its session for good
   * (sessions.mjs delete), and opens the next chat in its folder, or a new one there.
   * @param {any} cx
   */
  confirmDelete(cx) {
    const d = this.deleting;
    if (!d || d.busy) return;
    const chat = this.chats.find((c) => c.id === d.id);
    if (!chat) { this.cancelDelete(); return; }
    d.busy = true; d.error = null;
    cx.spawn(async (cx) => {
      const bridge = this.bridges.get(chat.id);
      if (bridge) { await bridge.quit(); bridge.close(); this.bridges.delete(chat.id); }
      if (chat.session) {
        const r = await deleteSession(chat.agent, chat.session, chat.file ?? null);
        if (!r.ok) { d.busy = false; d.error = r.message || "Couldn't delete it."; cx.notify(); return; }
      }
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

  // --- Settings ----------------------------------------------------------------------------------

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

  render(_cx) {
    if (this.launcher) return h_flex();
    const t = colors();
    const chatWidth = Math.max(0, this.width - TREE_WIDTH - GAP * 3);
    return h_flex().id("root").size_full().p(GAP).gap(GAP).bg(paneBackground(theme().background))
      .track_focus(this.handle)
      .on_key_down((e, cx) => handleKey(this, e, cx))
      .on_size_change((size, cx) => { this.width = size.width; cx.notify(); })
      .child(treeView(this, t))
      .child(chatView(this, t, chatWidth));
  }
}
