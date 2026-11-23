// Keys. Most can be changed in Settings (shortcuts.js lists them, with what they start on), so
// they are asked for by name with v.pressed(id, e), never by letter. Fixed: the tree moves with j,
// k, h, l, g and G (and the arrows), 1 to 9 pick a question's option, and the delete question
// takes enter, y, n and esc.

/** The messages' padding above the first row and below the last, as views/chat.js draws it. */
export const LIST_PAD_TOP = 16, LIST_PAD_BOTTOM = 10;

/** Hints with their keys, leaving out those whose key is off. @param {[string, string][]} hints */
function withKeys(hints) {
  return hints.filter(([key]) => key);
}

/** The key hints the tree shows while it has the keyboard. @param {any} v */
export function treeHints(v) {
  return withKeys([["j k", "move"], [v.keyHint("select"), "select"], ["l", "open"], ["h", "close"], [v.keyHint("delete"), "delete"],
    [v.keyHint("newChat"), "new chat"], [v.keyHint("openProject"), "open project"], [v.keyHint("chat"), "chat"]]);
}

/** The key hints while a selection is going. @param {any} v */
export function selectHints(v) {
  return withKeys([["j k", "extend"], [v.keyHint("delete"), "delete"], ["esc", "cancel"]]);
}

/**
 * The tree's rows in screen order, as cursor keys: `r:<chat>` in Recent, then `p:<project>` and,
 * when it is open, `c:<chat>` for each of its chats.
 * @param {any} v the view @returns {string[]}
 */
export function treeItems(v) {
  // While the list syncs it shows no rows, so the keys have none to move over.
  if (v.treeSyncing()) return [];
  const items = v.query ? [] : v.recentIds().map((/** @type {string} */ id) => `r:${id}`);
  for (const p of v.visibleProjects()) {
    items.push(`p:${p.id}`);
    if (v.isOpen(p.id)) for (const c of v.chatsIn(p.id)) items.push(`c:${c.id}`);
  }
  return items;
}

/**
 * Scrolls the chat one message. Herdr scrolls to a message, not by pixels, so the view keeps
 * each row's height and its own idea of the scroll position (`v.top`): down reveals the first
 * message cut off at the bottom, up the last one cut off at the top.
 * @param {any} v @param {1 | -1} dir
 */
export function scrollChat(v, dir) {
  const ids = v.rowIds();
  const heights = ids.map((/** @type {string} */ id) => v.rowHeights.get(id) ?? 0);
  const tops = [];
  let y = LIST_PAD_TOP;
  for (const h of heights) { tops.push(y); y += h; }
  const maxTop = Math.max(0, y + LIST_PAD_BOTTOM - v.viewH);
  if (v.atBottom) v.top = maxTop;
  v.top = Math.max(0, Math.min(maxTop, v.top));
  v.atBottom = false;
  if (dir > 0) {
    const edge = v.top + v.viewH;
    const i = tops.findIndex((top, k) => top + heights[k] > edge + 1);
    if (i < 0) { v.atBottom = true; return; }
    v.scroll.scroll_to_item(i);
    const last = i === ids.length - 1;
    v.top = Math.min(maxTop, tops[i] + heights[i] + (last ? LIST_PAD_BOTTOM : 0) - v.viewH);
    if (v.top >= maxTop) v.atBottom = true;
  } else {
    let i = -1;
    for (let k = tops.length - 1; k >= 0; k--) if (tops[k] < v.top - 1) { i = k; break; }
    if (i < 0) return;
    v.scroll.scroll_to_item(i);
    v.top = i === 0 ? 0 : tops[i];
  }
}

/**
 * The pane's key handler. It sees every key on the way up from whatever has the keyboard, the
 * message box included, so the ctrl keys win over the box's own (ctrl-h and ctrl-k delete text there).
 * @param {any} v @param {import("gpui-kit").KeyEvent} e @param {any} cx
 */
export function handleKey(v, e, cx) {
  const ks = e.keystroke;
  const done = () => { cx.stop_propagation(); cx.notify(); };
  const is = (/** @type {string} */ id) => v.pressed(id, e);
  // Settings covers the pane: keys don't reach what is behind it.
  if (v.settingsOpen) {
    // The Shortcuts tab takes every key: moving, switching, and the new key it waits for.
    if (v.settingsTab === "shortcuts" && v.shortcuts.open) {
      v.shortcuts.key(e, cx);
      if (!v.shortcuts.open) v.closeSettings(); // esc, or its own key, closed it
      return;
    }
    if (ks === "escape" || is("settings")) { v.closeSettings(); done(); }
    // Anything else goes to the initials box when it has the keyboard, and nowhere otherwise.
    return;
  }
  if (v.chatSearchOpen && v.zone === "chat-search") {
    if (ks === "escape") { v.toggleChatSearch(); done(); return; }
    if (ks === "enter" || ks === "shift-enter") { v.findChatMatch(ks === "shift-enter" ? -1 : 1); done(); return; }
  }
  if (v.modelPicker && ks === "escape") { v.modelPicker = null; done(); return; }
  if (v.outputsOpen && ks === "escape") { v.outputsOpen = false; done(); return; }
  // An image shown big: esc closes it.
  if (v.viewing && ks === "escape") { v.viewing = null; done(); return; }
  // The / menu over the message box: up and down (or ctrl-p and ctrl-n) move, tab or enter picks,
  // esc closes it. Other keys go on to the box.
  const slash = v.zone === "chat" ? v.slashItems() : null;
  if (slash?.length) {
    if (ks === "up" || ks === "ctrl-p") { v.moveSlash(-1); done(); return; }
    if (ks === "down" || ks === "ctrl-n") { v.moveSlash(1); done(); return; }
    if (ks === "tab" || ks === "enter") { v.pickSlash(slash[Math.min(v.slashIndex, slash.length - 1)]); done(); return; }
    if (ks === "escape") { v.closeSlash(); done(); return; }
  }
  // The delete question: enter (Delete has the focus) or y deletes, n or esc puts it away. Other keys wait.
  if (v.zone === "confirm") {
    if (ks === "enter" || ks === "y") v.confirmDelete(cx);
    else if (ks === "n" || ks === "escape") v.cancelDelete();
    done();
    return;
  }
  if (is("settings")) { v.toggleSettings(); done(); return; }
  // A question card is waiting and the box is empty: 1 to 9 pick an option of its next question.
  if (v.zone === "chat" && /^[1-9]$/.test(ks)) {
    const chat = v.chat(v.chatId);
    const card = v.question(chat);
    if (card && v.inputFor(chat.agent).value() === "") {
      const q = v.answeringQuestion(card);
      const option = q?.options?.[Number(ks) - 1];
      if (option) { v.pickAnswer(card, q, option.label, cx); done(); return; }
    }
  }
  // Stop ends the open chat's turn, from the message box or the permission bar.
  if (is("stop") && v.busy(v.chat(v.chatId)) && (v.zone === "chat" || v.zone === "ask")) { v.stop(); done(); return; }
  // A permission card is waiting: allow once, always allow, or deny. Other keys wait, except the ones below.
  if (v.zone === "ask") {
    if (is("allow")) { v.decide("allow", false, cx); done(); return; }
    if (is("always")) { v.decide("allow", true, cx); done(); return; }
    if (is("deny")) { v.decide("deny", false, cx); done(); return; }
  }
  // Jump opens the chat that just finished, and last switches between this chat and the one
  // before. They are taken even when there is nowhere to go, so the message box never gets them
  // (⌃o, their key to start with, inserts a line on macOS).
  if (is("jump")) { v.jumpToFresh(cx); done(); return; }
  if (is("last")) { v.switchBack(cx); done(); return; }
  if (is("tree")) { v.focusTree(); done(); return; }
  if (is("sidebar")) { v.toggleSidebar(); done(); return; }
  if (is("chat")) { v.focusInput(); done(); return; }
  if (is("scrollDown") || is("scrollUp")) { scrollChat(v, is("scrollDown") ? 1 : -1); done(); return; }
  if (v.zone === "search") {
    if (ks === "escape") { v.focusTree(); done(); }
    return;
  }
  if (v.zone !== "tree") return;

  const items = treeItems(v);
  // A search with no match leaves no row for the keys to act on: only esc does anything.
  if (items.length === 0) {
    if (ks === "escape") { v.focusInput(); done(); }
    return;
  }
  let i = items.indexOf(v.cursor);
  if (i < 0) i = 0;
  const cur = items[i];
  const id = cur.slice(2);
  const isProject = cur.startsWith("p:");
  // A selection: select starts or ends one. Shift with j, k or the arrows starts one and extends it.
  // While one is going, j, k, g and G extend it, delete deletes its chats and esc ends it.
  const shifted = ["shift-j", "shift-k", "shift-down", "shift-up"].includes(ks);
  if (is("select")) { v.anchor = v.anchor ? null : cur; done(); return; }
  if (shifted && !v.anchor) v.anchor = cur;
  if (v.anchor && ks === "escape") { v.anchor = null; done(); return; }
  if (v.anchor && is("delete")) { v.askDeleteSelected(); done(); return; }
  if (v.anchor && !shifted && !["j", "k", "down", "up", "g", "shift-g"].includes(ks) && e.key !== "G") v.anchor = null;
  // The shortcuts first: one may be on a key the tree also moves with.
  if (is("delete")) {
    if (isProject) v.askDeleteProject(id); else v.askDelete(id);
  } else if (is("openProject")) {
    v.newProject(cx);
    done();
    return;
  } else if (is("newChat")) {
    // A new chat in the folder under the cursor, or the folder of the chat under it, ready to type in.
    const project = isProject ? id : v.chat(id)?.project;
    if (!project) { done(); return; }
    v.newChat(project, cx);
    v.focusInput();
    done();
    return;
  } else if (ks === "j" || ks === "down" || ks === "shift-j" || ks === "shift-down") v.cursor = items[Math.min(i + 1, items.length - 1)];
  else if (ks === "k" || ks === "up" || ks === "shift-k" || ks === "shift-up") v.cursor = items[Math.max(i - 1, 0)];
  else if (ks === "g") v.cursor = items[0];
  else if (ks === "shift-g" || e.key === "G") v.cursor = items[items.length - 1];
  else if (ks === "l" || ks === "enter" || ks === "right") {
    if (!isProject) v.openChat(id, cx);
    else if (v.collapsed[id]) v.setCollapsed(id, false);
    else if (ks === "enter") v.setCollapsed(id, true);
  } else if (ks === "h" || ks === "left") {
    if (cur.startsWith("r:")) { done(); return; }
    const project = isProject ? id : v.chat(id).project;
    v.setCollapsed(project, true);
    v.cursor = `p:${project}`;
  } else if (ks === "escape") v.focusInput();
  else return;
  v.revealCursor();
  done();
}
