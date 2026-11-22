// The sidebar card: the title, search, Recent, the project tree, and your picture with the settings gear.
import { div, svg } from "gpui-kit";
import { h_flex, v_flex, Input } from "gpui-base";
import { agentPicture } from "../pictures.js";
import { legend } from "../kit/legend.js";
import { focusBorder } from "../kit/theme.js";
import { TREE_HINTS, SELECT_HINTS } from "../keys.js";
import { settingsView } from "./settings.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */

const ICONS = "mods/hey-chat/icons";

/** The sidebar's width in pixels. */
export const TREE_WIDTH = 320;

/** A transparent border, so a row keeps its size when the cursor's border comes and goes. */
const CLEAR = "#00000000";

/** A theme color at some strength (0 to 1), or the color as it is when it isn't #rrggbb. @param {string} color @param {number} strength */
function soft(color, strength) {
  return /^#[0-9a-f]{6}$/i.test(String(color)) ? `${color}${Math.round(strength * 255).toString(16).padStart(2, "0")}` : color;
}

/** The border of the card that has the keyboard: the kit's focus color. */
export { focusBorder };

/** The tree cursor's outline on row `key`, while the tree has the keyboard: the text color, a little stronger. @param {any} v @param {Theme} t @param {string} key */
function cursorBorder(v, t, key) {
  return v.zone === "tree" && v.cursor === key ? soft(t.foreground, 0.35) : CLEAR;
}

/** A round icon button. @param {Theme} t @param {string} id @param {string} icon @param {number} size @param {(cx: any) => void} click */
export function roundButton(t, id, icon, size, click) {
  return h_flex().id(id).flex_none().size(size).rounded_full().items_center().justify_center().cursor_pointer()
    .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
    // The click stays here, so a button inside a row (a folder's + and trash) doesn't also click the row.
    .on_click((_e, cx) => { cx.stop_propagation(); click(cx); cx.notify(); })
    .child(svg(icon).size(Math.round(size * 0.5)));
}

/**
 * One chat's row: the agent's picture, the title and time, and a preview with an unread dot.
 * @param {any} v the view @param {Theme} t @param {any} chat @param {string} key `r:` in Recent, `c:` in a project
 */
function chatRow(v, t, chat, key) {
  const open = chat.id === v.chatId;
  const picked = Boolean(v.selectedSet?.has(chat.id));
  const unread = Boolean(v.unread[chat.id]) && !open;
  const asking = v.needsYou(chat);
  const thinking = v.thinking(chat) && !asking;
  const last = chat.thread[chat.thread.length - 1];
  let preview = chat.last ? (chat.lastFrom === "me" ? `You: ${chat.last}` : chat.last) : "No messages yet";
  if (last) {
    preview = last.kind === "tool" ? last.title : last.kind === "code" ? "Sent a code snippet" : last.kind === "image" ? "Sent an image" : last.text;
    if (last.from === "me") preview = `You: ${preview}`;
  }
  if (thinking) preview = "Thinking…";
  if (asking) preview = "Waiting for you";
  if (key.startsWith("r:")) preview = `${chat.project} · ${preview}`;
  return h_flex().id(`row-${key}`).w_full().flex_none().gap(10).px(10).py(8).rounded(12).items_center().cursor_pointer()
    .border_1().border_color(cursorBorder(v, t, key))
    .when(open || picked, (el) => el.bg(t.selected))
    .hover((s) => s.bg(open || picked ? t.selected : t.hover))
    // Shift-click selects from the cursor to this chat. A plain click opens it.
    .on_click((e, cx) => {
      if (e.modifiers?.shift) { if (!v.anchor) v.anchor = v.cursor || key; v.cursor = key; v.zone = "tree"; v.handle.focus(); }
      else { v.anchor = null; v.openChat(chat.id, cx); }
      cx.notify();
    })
    .child(agentPicture(chat.agent, 34))
    .child(v_flex().flex_1().min_w(0).gap(2)
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().text_size(14).text_color(t.foreground)
          .when(unread, (el) => el.font_semibold()).when(!unread, (el) => el.font_medium()).child(chat.title))
        .child(div().flex_none().text_size(11.5).text_color(t.dim).child(chat.time)))
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().text_size(12.5)
          .text_color(asking ? t.blocked : thinking ? t.working : unread ? t.foreground : t.muted)
          .when(unread, (el) => el.font_semibold()).child(preview))
        .when(unread, (el) => el.child(div().flex_none().size(9).rounded_full().bg(t.accent)))));
}

/** A project's row: chevron, folder, name, chat count, and a + that starts a chat there. @param {any} v @param {Theme} t @param {import("../store.js").Project} p @param {number} count */
function projectRow(v, t, p, count) {
  const open = v.isOpen(p.id);
  return h_flex().id(`proj-${p.id}`).w_full().h(34).flex_none().gap(8).pl(8).pr(4).rounded(10).items_center()
    .cursor_pointer().text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
    .border_1().border_color(cursorBorder(v, t, `p:${p.id}`))
    .on_click((_e, cx) => { v.toggleProject(p.id); v.cursor = `p:${p.id}`; cx.notify(); })
    .child(svg(`${ICONS}/${open ? "chevron-down" : "chevron"}.svg`).size(12).flex_none())
    .child(svg(`${ICONS}/folder.svg`).size(16).flex_none())
    .child(div().flex_1().min_w(0).truncate().text_size(13).font_semibold().child(p.id))
    .child(div().flex_none().text_size(12).text_color(t.dim).child(String(count)))
    .child(roundButton(t, `new-${p.id}`, `${ICONS}/plus.svg`, 28, (cx) => { v.newChat(p.id, cx); cx.notify(); }))
    .child(roundButton(t, `delete-${p.id}`, `${ICONS}/trash.svg`, 28, () => v.askDeleteProject(p.id)));
}

/** "Delete … ?" with y and n, for the chat v.deleting names. @param {any} v @param {Theme} t */
function deleteCard(v, t) {
  const d = v.deleting;
  const chat = d.project || d.ids ? null : v.chats.find((/** @type {any} */ c) => c.id === d.id);
  const count = d.project ? v.chats.filter((/** @type {any} */ c) => c.project === d.project).length : d.ids ? d.ids.length : 0;
  const question = d.project ? `Delete all ${count} chat${count === 1 ? "" : "s"} in \u201c${d.project}\u201d?`
    : d.ids ? `Delete ${count} chats?` : `Delete \u201c${chat?.title ?? "this chat"}\u201d?`;
  const what = d.project ? "Their Claude and Codex sessions are deleted for good. The folder on your disk isn't touched."
    : d.ids ? "Their Claude and Codex sessions are deleted for good."
    : !chat?.session ? "This chat has no messages yet."
    : chat.agent === "codex" ? "Its Codex session is deleted for good." : "Its Claude session is deleted for good.";
  const progress = (d.project || d.ids) && d.total ? `Deleting ${Math.min(d.done + 1, d.total)} of ${d.total}\u2026` : "Deleting\u2026";
  return v_flex().flex_none().mx(10).mt(8).p(12).gap(10).rounded(12).bg(t.raised).border_1().border_color(t.blocked)
    .child(v_flex().gap(4)
      .child(div().text_size(13.5).font_semibold().text_color(t.foreground).child(question))
      .child(div().text_size(12).text_color(t.muted).child(d.busy ? progress : what)))
    .when(Boolean(d.error), (el) => el.child(div().text_size(12).text_color(t.blocked).child(d.error ?? "")))
    .child(h_flex().gap(8)
      // Delete has the focus, drawn with a ring: enter presses it.
      .child(h_flex().id("delete-yes").h(30).px(12).gap(6).items_center().rounded_full().cursor_pointer().bg(t.blocked)
        .border_2().border_color(t.foreground)
        .text_size(12.5).font_medium().text_color("#ffffff")
        .on_click((_e, cx) => { v.confirmDelete(cx); cx.notify(); })
        .when(v.keyHints, (el) => el.child(div().font_semibold().opacity(0.75).child("\u21b5"))).child("Delete"))
      .child(h_flex().id("delete-no").h(30).px(12).gap(6).items_center().rounded_full().cursor_pointer().bg(t.background)
        .border_1().border_color(t.border).text_size(12.5).font_medium().text_color(t.foreground).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { v.cancelDelete(); cx.notify(); })
        .when(v.keyHints, (el) => el.child(div().font_semibold().opacity(0.75).child("n"))).child("Cancel")));
}

/** The whole sidebar card. @param {any} v @param {Theme} t */
export function treeView(v, t) {
  // The chats a selection covers, for chatRow's highlight.
  v.selectedSet = new Set(v.selectedIds());
  // Every row is a direct child of the scrolling list, so the list overflows (and scrolls) instead
  // of squeezing them, and the j/k cursor can scroll its row into view by index (v.treeKeys).
  /** @type {any[]} */
  const rows = [];
  /** @type {(string | null)[]} */
  const keys = [];
  const add = (/** @type {any} */ el, /** @type {string | null} */ key = null) => { rows.push(el.flex_none()); keys.push(key); };
  const recent = v.query ? [] : v.recentIds();
  if (recent.length > 0) {
    add(h_flex().h(30).px(8).gap(8).items_center().text_color(t.muted)
      .child(svg(`${ICONS}/clock.svg`).size(15))
      .child(div().text_size(13).font_semibold().child("Recent")));
    for (const id of recent) add(chatRow(v, t, v.chat(id), `r:${id}`), `r:${id}`);
    add(div().h(1).my(6).bg(t.border));
  }
  const projects = v.visibleProjects();
  for (const p of projects) {
    const chats = v.chatsIn(p.id);
    add(projectRow(v, t, p, chats.length).when(rows.length > 0, (el) => el.mt(4)), `p:${p.id}`);
    if (v.isOpen(p.id)) for (const c of chats) add(div().w_full().pl(10).child(chatRow(v, t, c, `c:${c.id}`)), `c:${c.id}`);
  }
  if (!v.loaded) add(div().px(10).py(8).text_size(12.5).text_color(t.dim).child("Finding your sessions\u2026"));
  if (v.query && projects.length === 0) add(div().px(10).py(8).text_size(12.5).text_color(t.dim).child("No chats match."));
  v.treeKeys = keys;

  const lit = v.zone === "tree" || v.zone === "search";
  return v_flex().id("tree").relative().w(TREE_WIDTH).flex_none().h_full().rounded(14).border_1().border_color(lit ? focusBorder(t) : t.border).bg(t.background)
    // Search (filters the chats by title, last message and folder), then new project and new chat.
    // Herdr's pane header already names the mod, so the sidebar has no title of its own.
    .child(h_flex().flex_none().gap(6).items_center().pl(14).pr(10).pt(14).pb(8)
      .child(h_flex().flex_1().min_w(0).h(36).px(12).gap(8).items_center().rounded_full().bg(t.raised).border_1().border_color(t.border)
        .child(svg(`${ICONS}/search.svg`).size(15).flex_none().text_color(t.dim))
        .child(Input.new(v.searchInput).flex_1().text_size(13.5).text_color(t.foreground)))
      .child(roundButton(t, "new-here", `${ICONS}/pencil.svg`, 36, (cx) => { v.newChat(v.chat(v.chatId).project, cx); cx.notify(); })))
    .child(h_flex().id("open-project").flex_none().mx(14).mb(8).h(28).gap(6).items_center().cursor_pointer().text_size(12.5).text_color(t.muted)
      .hover(s => s.text_color(t.foreground))
      .on_click((_e, cx) => { v.newProject(cx); cx.notify(); })
      .child(svg(`${ICONS}/folder-plus.svg`).size(14)).child("Open project"))
    // Recent, then the projects.
    // Recent (except while searching), then the projects.
    .child(v_flex().id("tree-scroll").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(v.treeScroll).px(8).pb(8).gap(2)
      .children(rows))
    // The delete question, above the bottom row.
    .when(Boolean(v.deleting), (el) => el.child(deleteCard(v, t)))
    // The tree's keys, while it has the keyboard.
    .when(v.zone === "tree" && v.keyHints, (el) => el.child(div().flex_none().px(16).pt(8).pb(4).child(legend(t, v.anchor ? SELECT_HINTS : TREE_HINTS))))
    // The bottom row: hide the sidebar (ctrl-b) on the left, the Settings gear on the right.
    .child(h_flex().flex_none().mx(8).my(8).px(4).py(4).items_center().justify_between()
      .child(roundButton(t, "hide-sidebar", `${ICONS}/sidebar.svg`, 36, () => v.toggleSidebar()))
      .child(roundButton(t, "open-settings", "mods/hey-chat/kit/gear.svg", 36, () => v.toggleSettings())
        .when(v.settingsOpen, (el) => el.bg(t.hover).text_color(t.foreground))))
    .when(v.settingsOpen, (el) => el.child(settingsView(v, t)));
}
