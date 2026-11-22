// Hey, chat: a Messenger-style chat with Claude Code or Codex, grouped by project folder.
// Scope and design: ../../SCOPE.md. Built so far: A1 (the pane, its layout and the opacity rules),
// A2 (keys and focus), A3 (Settings and your picture), A4 (Claude through the bridge) and A5 (Codex).
// The sample chats stay until existing sessions fill the tree (A6). The pieces:
//   sample.js     the sample projects and chats
//   store.js      the real chats and their folders, kept in <appHome>/data/hey-chat/chats.json
//   agent.js      finding the CLIs, and each chat's link to its bridge
//   bridge.mjs    the Node program that runs a chat's agent (started by agent.js)
//   messages.js   bridge events to messages, tool cards and permission cards
//   pictures.js   Claude's, Codex's and your profile pictures
//   me.js         your initials, color and picture, and copying a photo in
//   keys.js       the keys: moving between tree and chat, the tree cursor, scrolling the chat
//   views/        the sidebar (tree.js), the chat (chat.js) and the Settings card (settings.js)
import { View } from "gpui-kit";
import { h_flex, InputState, ScrollHandle } from "gpui-base";
import { nextCommand, panes, props, run, focused, closeOverlay, theme, window, playSound, checking } from "herdr";
import { loadMe, saveMe, pickPhoto, importPhoto, dropPhoto } from "./me.js";
import { colors, paneBackground } from "./kit/theme.js";
import { PROJECTS, sampleChats } from "./sample.js";
import { AGENTS } from "./pictures.js";
import { Bridge, findAgents } from "./agent.js";
import { applyEvent, resetThread, pendingAsk, clock } from "./messages.js";
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
    /** @type {any[]} every chat: the samples, and real ones ({ real: true, cwd, session, working, ... }) */
    this.chats = sampleChats();
    /** @type {import("./store.js").Project[]} */
    this.projects = PROJECTS.map((p) => ({ ...p, cwd: expand(p.path) }));
    this.chatId = "tour";
    this.typing = "tour";          // the sample chat showing the typing dots, or null
    this.unread = { sync: true, readme: true };
    this.collapsed = { dotfiles: true };
    this.openTools = new Set(["c4"]); // tool cards shown open
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
    // "settings" (the initials box) or "ask" (a permission bar is waiting on y, a or n).
    this.zone = "chat";
    this.cursor = "c:tour";        // the tree row j and k are on (keys.js treeItems)
    // For ctrl-j and ctrl-k (keys.js scrollChat): each message row's height by its id, the
    // messages area's height, the scroll position the keys believe in, and whether it is at the end.
    this.rowHeights = new Map();
    this.viewH = 0; this.top = 0; this.atBottom = true;
    this.scroll = ScrollHandle.new();
    this.searchInput = InputState.new({ placeholder: "Search" });
    this.searchInput.on("focus", (_e, cx) => { this.zone = "search"; cx.notify(); });
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
    this.scrollDown();
    // The message box has the keyboard when the pane opens. The pane isn't drawn yet, so again once it is.
    this.focusInput();
    cx.timer.after(50, () => { if (this.zone === "chat") this.focusInput(); });
    cx.timer.after(400, () => { if (this.zone === "chat") this.focusInput(); });
    if (checking()) return;
    // The folder the pane was opened from is a project. Then the saved chats, reconnected to
    // their bridges where those still run, and the CLIs on PATH.
    const start = props()?.folder ?? focused()?.cwd ?? null;
    if (start) { const id = this.addProject(start); this.collapsed = { ...this.collapsed, [id]: false }; }
    cx.spawn(async (cx) => { await this.loadChats(cx); cx.notify(); });
    cx.spawn(async (cx) => { this.agents = await findAgents(); cx.notify(); });
  }

  async close() {
    if (this.launcher) return;
    for (const b of this.bridges.values()) b.close();
    this.scroll.release(); this.searchInput.release(); this.initialsInput.release();
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
    this.projects.unshift({ id: name, path: tilde(cwd), cwd, saved: true });
    return name;
  }

  /** @param {string} id */
  project(id) { return this.projects.find((p) => p.id === id) ?? null; }

  /** Loads the saved chats and links each one whose bridge still runs. @param {any} cx */
  async loadChats(cx) {
    const s = await loadStore();
    for (const p of s.projects) if (p?.path) this.addProject(expand(p.path), p.id);
    for (const c of s.chats) {
      if (!c?.id || this.chats.some((x) => x.id === c.id)) continue;
      const cwd = String(c.cwd ?? "");
      const chat = { ...c, project: this.addProject(cwd, c.project), real: true, thread: [] };
      resetThread(chat);
      this.chats.push(chat);
      this.link(chat, cx, false);
    }
    cx.notify();
  }

  /** Saves the real chats. */
  saveChats() { saveStore(this.chats, this.projects); }

  /** @param {string} id */
  chat(id) { return this.chats.find((c) => c.id === id) ?? this.chats[0]; }

  /** A project's chats, newest first. @param {string} project */
  chatsIn(project) {
    return this.chats.filter((c) => c.project === project).sort((a, b) => b.stamp - a.stamp);
  }

  /** The two chats with the newest messages, from any project. */
  recentIds() {
    return this.chats.slice().sort((a, b) => b.stamp - a.stamp).slice(0, 2).map((c) => c.id);
  }

  /** True while a chat's agent works on your message: the typing dots and "Thinking…". @param {any} chat */
  busy(chat) {
    return chat.real ? Boolean(chat.working || chat.connecting) : this.typing === chat.id;
  }

  /** The permission card a chat is waiting on you for, or null. @param {any} chat */
  waiting(chat) {
    return chat.real ? pendingAsk(chat) : null;
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
    this.chatId = id;
    this.cursor = `c:${id}`;
    this.unread = { ...this.unread, [id]: false };
    const chat = this.chat(id);
    if (chat.real && !this.bridges.has(id)) this.link(chat, cx, false);
    this.scrollDown();
    this.focusInput();
  }

  /** @param {string} project */
  toggleProject(project) {
    this.collapsed = { ...this.collapsed, [project]: !this.collapsed[project] };
  }

  /** Starts an empty chat in a project, with the agent of the chat that is open. @param {string} project @param {any} cx */
  newChat(project, cx) {
    const p = this.project(project);
    const id = `c${Date.now().toString(36)}`;
    const chat = { id, project, cwd: p?.cwd ?? "", agent: this.chat(this.chatId).agent, title: "New chat", time: "Now", stamp: Date.now(), real: true, session: null, thread: [] };
    resetThread(chat);
    this.chats.push(chat);
    this.collapsed = { ...this.collapsed, [project]: false };
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
          if (running) resetThread(chat);
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
   * Sends the message box's text. A real chat goes to its agent through the bridge. A sample
   * chat gets a sample reply.
   * @param {any} cx
   */
  send(cx) {
    const chat = this.chat(this.chatId);
    const box = this.inputFor(chat.agent);
    const text = box.value().trim();
    if (!text || this.busy(chat)) return;
    box.set_value("");
    if (!chat.real) { this.sampleReply(chat, text, cx); return; }
    if (chat.thread.length === 0) chat.title = text.length > 32 ? `${text.slice(0, 31)}…` : text;
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

  /** A sample chat's reply, until existing sessions replace the samples (A6). @param {any} chat @param {string} text @param {any} cx */
  sampleReply(chat, text, cx) {
    const time = clock(Date.now());
    chat.thread.push({ id: `m${Date.now()}`, kind: "text", from: "me", text, time });
    chat.time = time; chat.stamp = Date.now();
    this.typing = chat.id;
    this.scrollDown();
    cx.timer.after(1600, (cx) => {
      chat.thread.push({ id: `r${Date.now()}`, kind: "text", from: "agent", text: "This is a sample chat. Start a new chat to talk to Claude or Codex." });
      if (this.typing === chat.id) this.typing = null;
      if (this.chatId !== chat.id) this.unread = { ...this.unread, [chat.id]: true };
      else this.scrollDown();
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
