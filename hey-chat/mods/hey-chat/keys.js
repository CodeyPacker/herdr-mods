// Keys (scope section 7): ctrl-h and ctrl-l move between the tree and the message box, ctrl-j and
// ctrl-k scroll the chat from anywhere, the tree moves with j, k, h, l, g and G, a permission bar
// takes y, a and n, d asks to delete a chat, and ctrl-c stops a turn.

/** The messages' padding above the first row and below the last, as views/chat.js draws it. */
export const LIST_PAD_TOP = 16, LIST_PAD_BOTTOM = 10;

/** The key hints the tree shows while it has the keyboard. */
export const TREE_HINTS = [["j k", "move"], ["l", "open"], ["h", "close"], ["d", "delete"], ["⌃l", "chat"]];

/**
 * The tree's rows in screen order, as cursor keys: `r:<chat>` in Recent, then `p:<project>` and,
 * when it is open, `c:<chat>` for each of its chats.
 * @param {any} v the view @returns {string[]}
 */
export function treeItems(v) {
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
  // The delete question: enter (Delete has the focus) or y deletes, n or esc puts it away. Other keys wait.
  if (v.zone === "confirm") {
    if (ks === "enter" || ks === "y") v.confirmDelete(cx);
    else if (ks === "n" || ks === "escape") v.cancelDelete();
    done();
    return;
  }
  // Settings is open: esc closes it, wherever the keyboard is.
  if (v.settingsOpen && ks === "escape") { v.closeSettings(); done(); return; }
  if (v.zone === "settings") {
    if (ks === "ctrl-h" || ks === "ctrl-l") { v.closeSettings(); if (ks === "ctrl-h") v.focusTree(); done(); }
    return;
  }
  // ctrl-c stops the open chat's turn, from the message box or the permission bar.
  if (ks === "ctrl-c" && v.busy(v.chat(v.chatId)) && (v.zone === "chat" || v.zone === "ask")) { v.stop(); done(); return; }
  // A permission card is waiting: y allows once, a always, n denies. Other keys wait, except the ctrl ones below.
  if (v.zone === "ask") {
    if (ks === "y") { v.decide("allow", false, cx); done(); return; }
    if (ks === "a") { v.decide("allow", true, cx); done(); return; }
    if (ks === "n") { v.decide("deny", false, cx); done(); return; }
  }
  if (ks === "ctrl-h") { v.focusTree(); done(); return; }
  if (ks === "ctrl-l") { v.focusInput(); done(); return; }
  if (ks === "ctrl-j" || ks === "ctrl-k") { scrollChat(v, ks === "ctrl-j" ? 1 : -1); done(); return; }
  if (v.zone === "search") {
    if (ks === "escape") { v.focusTree(); done(); }
    return;
  }
  if (v.zone !== "tree") return;

  const items = treeItems(v);
  let i = items.indexOf(v.cursor);
  if (i < 0) i = 0;
  const cur = items[i];
  const id = cur.slice(2);
  const isProject = cur.startsWith("p:");
  if (ks === "j" || ks === "down") v.cursor = items[Math.min(i + 1, items.length - 1)];
  else if (ks === "k" || ks === "up") v.cursor = items[Math.max(i - 1, 0)];
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
  } else if (ks === "d") {
    if (isProject) return;
    v.askDelete(id);
  } else if (ks === "escape") v.focusInput();
  else return;
  v.revealCursor();
  done();
}
