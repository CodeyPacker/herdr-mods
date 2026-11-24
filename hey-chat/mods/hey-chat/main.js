// Hey, chat: a Messenger-style chat with Claude Code or Codex, grouped by project folder.
// The pieces:
//   main.js       the view: its state, its message boxes, and how its parts are laid out
//   actions/      the view's methods, by area (chats, talk, questions, delete, ...). main.js adds them to the view
//   tabs.js       the shortcut, and each project's chat tab
//   picker.js     the project list (⌃p): every chat tab, in every space
//   store.js      the chats made here and their folders, kept in <appHome>/data/hey-chat/chats.json
//   agent.js      finding the CLIs, listing and reading sessions, and each chat's link to its bridge
//   bridge.mjs    the Node program that runs a chat's agent (started by agent.js)
//   sessions.mjs  the Node program that lists your Claude and Codex sessions and reads their history
//   messages.js   bridge events to messages, tool cards and permission cards
//   pictures.js   Claude's, Codex's and your profile pictures
//   me.js         your initials, color and picture, and copying a photo in
//   keys.js       the keys: moving between tree and chat, the tree cursor, scrolling the chat
//   views/        the sidebar (tree.js), the chat (chat.js), Settings, setup and the Files panel
import { View } from "gpui-kit";
import { h_flex, InputState, TextareaState, ScrollHandle } from "gpui-base";
import { nextCommand, props, focused, closeOverlay, theme, checking, shared, home, panes } from "herdr";
import { loadMe } from "./me.js";
import { colors, paneBackground } from "./kit/theme.js";
import { AGENTS } from "./pictures.js";
import { expand } from "./store.js";
import { toggle, claimTab } from "./tabs.js";
import { COLLAPSED, SIDEBAR_HIDDEN, CONDENSE_CHAT, normalFolder } from "./common.js";
import { makeShortcuts } from "./shortcuts.js";
import { treeView, TREE_WIDTH } from "./views/tree.js";
import { outputsView, OUTPUTS_WIDTH } from "./views/outputs.js";
import { setupView } from "./views/setup.js";
import { chatView, imageViewer } from "./views/chat.js";
import { handleKey } from "./keys.js";
import { chats } from "./actions/chats.js";
import { focus } from "./actions/focus.js";
import { scroll } from "./actions/scroll.js";
import { talk } from "./actions/talk.js";
import { questions } from "./actions/questions.js";
import { models } from "./actions/models.js";
import { setup } from "./actions/setup.js";
import { attachments } from "./actions/attachments.js";
import { slash } from "./actions/slash.js";
import { deleting } from "./actions/delete.js";
import { settings } from "./actions/settings.js";
import { copy } from "./actions/copy.js";
import { settingsDialog } from "./views/settings.js";
import { outputs } from "./actions/outputs.js";
import { jump } from "./actions/jump.js";
import { Picker, openPicker } from "./picker.js";

/** The space around and between the two cards. */
const GAP = 10;

export default class HeyChat extends View {
  init(_props, cx) {
    // The project list's copy (⌃p): a popup of every chat tab.
    if (props()?.projects) { this.picker = new Picker(cx); return; }
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
    // The keys you can change (shortcuts.js), and whether key hints show, which they keep too.
    this.shortcuts = makeShortcuts((id, on) => this.shortcutChanged(id, on));
    this.keyHints = this.shortcuts.showHints;
    this.condenseChat = shared(CONDENSE_CHAT) !== false;
    this.loaded = false;           // the sessions have been listed
    this.syncing = new Set();      // chats whose running bridge is still replaying them, by id
    // ⌃g and ⌃o (actions/jump.js): chats whose turn just finished ({ id, until }, newest first),
    // and the chat you were in before this one, by id.
    this.fresh = [];
    this.previous = null;
    this.starting = !checking();   // keep the startup chat hidden until history and layout settle
    this.restoring = null;
    this.openTools = new Set();    // tool cards shown open
    /** @type {Map<string, import("./agent.js").Bridge>} each real chat's link to its bridge */
    this.bridges = new Map();
    /** @type {Map<string, Promise<import("./agent.js").Bridge | null>>} Connections still opening. */
    this.links = new Map();
    this.outputsOpen = false;
    this.chatSearchOpen = false;
    this.chatSearchIndex = 0;
    this.chatSearchInput = InputState.new({ placeholder: "Find in loaded messages" });
    this.chatSearchInput.on("focus", (_e, cx) => { this.zone = "chat-search"; cx.notify(); });
    this.chatSearchInput.on("change", (_e, cx) => { this.chatSearchIndex = 0; this.findChatMatch(0); cx.notify(); });
    this.outputPreview = null;
    this.outputError = null;
    this.outputToast = null;       // the toast for a new file or link: { chat, text }, while it shows
    this.setupOpen = Boolean(props()?.setup);
    this.setupAgent = "codex";
    this.setupChecking = false;
    this.setupState = null;
    this.agents = null;            // the CLIs on PATH, once found: ["node", "claude", ...]
    this.me = loadMe();
    // Settings: whether the dialog is open and on which tab, a photo being copied in, and why the last one failed.
    this.settingsOpen = false;
    this.settingsTab = "general";
    // The copy button: the message it shows beside, a count that cancels its pending hide, and
    // the message just copied ({ id }), which shows a check.
    this.copyFor = null;
    this.copyLinger = 0;
    this.copied = null;
    this.photoBusy = false; this.photoError = null;
    this.initialsInput = InputState.new({ placeholder: "Me", value: this.me.initials });
    this.initialsInput.on("focus", (_e, cx) => { this.zone = "settings"; cx.notify(); });
    this.initialsInput.on("change", (_e, cx) => this.setInitials(cx));
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
    this.inputs = Object.fromEntries(Object.entries(AGENTS).map(([id, a]) => [id, this.messageBox(a.name)]));
    this.handle = cx.focus_handle();
    cx.spawn(async (cx) => { for (;;) { this.command(await nextCommand(), cx); cx.notify(); } });
    // A new chat in the folder the pane was opened from, ready to type into. Your sessions fill
    // the tree around it once they're listed.
    const start = checking() ? home() : (props()?.folder ?? focused()?.cwd ?? home());
    this.folder = normalFolder(expand(start));
    if (!checking()) claimTab(props()?.pane, this.folder);
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

  /**
   * A message box for talking to `agent`. Enter sends and shift-enter is a new line. Text
   * changes, pastes and focus reach the view.
   * @param {string} agent
   */
  messageBox(agent) {
    const box = TextareaState.new({ placeholder: `Message ${agent}` });
    box.set_auto_grow(1, 8);
    box.on("change", (_e, cx) => { this.pastedPath(box, cx); this.slashChanged(cx); cx.notify(); });
    // The box may add the new line itself on either key, so this makes sure shift-enter has one
    // and plain enter doesn't.
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
    return box;
  }

  async close() {
    if (this.picker) { this.picker.release(); return; }
    if (this.launcher) return;
    for (const b of this.bridges.values()) b.close();
    this.scroll.release(); this.treeScroll.release(); this.searchInput.release(); this.initialsInput.release(); this.chatSearchInput.release();
    this.shortcuts.scroll.release();
    for (const box of Object.values(this.inputs)) box.release();
  }

  /** ⌃p: the project list (picker.js). */
  openProjects() { openPicker(); }

  /** `hey-chat.<name>` commands: focus. */
  command(c, cx) {
    if (c !== "focus") return;
    // Every chat tab's copy gets the command. Only the one whose pane has the keyboard takes it,
    // again once its tab, just shown, has drawn.
    const own = panes().find(p => p.pane === props()?.pane);
    if (own && !own.focused) return;
    this.focusInput();
    cx.timer.after(50, () => { if (this.zone === "chat") this.focusInput(); });
  }

  render(_cx) {
    if (this.picker) return this.picker.render();
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
      .when(Boolean(this.viewing), (el) => el.child(imageViewer(this)))
      .when(this.settingsOpen, (el) => el.child(settingsDialog(this, t)));
  }
}

/**
 * Adds each part's methods to the view. Two parts with a method of the same name would silently
 * replace one another, so that stops the mod from loading instead.
 * @param {any} target @param {Record<string, Function>[]} parts
 */
function addMethods(target, ...parts) {
  for (const part of parts) {
    for (const name of Object.keys(part)) {
      if (Object.hasOwn(target, name)) throw new Error(`Hey, chat: two parts define ${name}().`);
      target[name] = part[name];
    }
  }
}

addMethods(HeyChat.prototype, chats, focus, scroll, talk, questions, models, setup, attachments, slash, deleting, settings, outputs, jump, copy);
