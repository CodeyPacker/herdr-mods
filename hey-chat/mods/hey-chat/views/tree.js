// The sidebar card: the title, search, Recent, the project tree, and your picture with the settings gear.
import { div, svg } from "gpui-kit";
import { h_flex, v_flex, Input } from "gpui-base";
import { agentPicture, myPicture } from "../pictures.js";
import { legend } from "../kit/legend.js";
import { TREE_HINTS } from "../keys.js";
import { settingsView } from "./settings.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */

const ICONS = "mods/hey-chat/icons";

/** The sidebar's width in pixels. */
export const TREE_WIDTH = 320;

/** A transparent border, so a row keeps its size when the cursor's border comes and goes. */
const CLEAR = "#00000000";

/** The border of the card that has the keyboard: the accent, softened. @param {Theme} t */
export function focusBorder(t) {
  return /^#[0-9a-f]{6}$/i.test(String(t.accent)) ? `${t.accent}8c` : t.accent;
}

/** The tree cursor's outline on row `key`, while the tree has the keyboard. @param {any} v @param {Theme} t @param {string} key */
function cursorBorder(v, t, key) {
  return v.zone === "tree" && v.cursor === key ? t.accent : CLEAR;
}

/** A round icon button. @param {Theme} t @param {string} id @param {string} icon @param {number} size @param {(cx: any) => void} click */
export function roundButton(t, id, icon, size, click) {
  return h_flex().id(id).flex_none().size(size).rounded_full().items_center().justify_center().cursor_pointer()
    .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
    .on_click((_e, cx) => click(cx))
    .child(svg(icon).size(Math.round(size * 0.5)));
}

/**
 * One chat's row: the agent's picture, the title and time, and a preview with an unread dot.
 * @param {any} v the view @param {Theme} t @param {import("../sample.js").Chat} chat @param {string} key `r:` in Recent, `c:` in a project
 */
function chatRow(v, t, chat, key) {
  const open = chat.id === v.chatId;
  const unread = Boolean(v.unread[chat.id]) && !open;
  const asking = Boolean(v.waiting(chat));
  const thinking = v.busy(chat) && !asking;
  const last = chat.thread[chat.thread.length - 1];
  let preview = "No messages yet";
  if (last) {
    preview = last.kind === "tool" ? last.title : last.kind === "code" ? "Sent a code snippet" : last.text;
    if (last.from === "me") preview = `You: ${preview}`;
  }
  if (thinking) preview = "Thinking…";
  if (asking) preview = "Waiting for you";
  if (key.startsWith("r:")) preview = `${chat.project} · ${preview}`;
  return h_flex().id(`row-${key}`).w_full().flex_none().gap(10).px(10).py(8).rounded(12).items_center().cursor_pointer()
    .border_1().border_color(cursorBorder(v, t, key))
    .when(open, (el) => el.bg(t.selected))
    .hover((s) => s.bg(open ? t.selected : t.hover))
    .on_click((_e, cx) => { v.openChat(chat.id, cx); cx.notify(); })
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

/** A project's row: chevron, folder, name, chat count, and a + that starts a chat there. @param {any} v @param {Theme} t @param {import("../sample.js").Project} p @param {number} count */
function projectRow(v, t, p, count) {
  const open = !v.collapsed[p.id];
  return h_flex().id(`proj-${p.id}`).w_full().h(34).flex_none().gap(8).pl(8).pr(4).rounded(10).items_center()
    .cursor_pointer().text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
    .border_1().border_color(cursorBorder(v, t, `p:${p.id}`))
    .on_click((_e, cx) => { v.toggleProject(p.id); v.cursor = `p:${p.id}`; cx.notify(); })
    .child(svg(`${ICONS}/${open ? "chevron-down" : "chevron"}.svg`).size(12).flex_none())
    .child(svg(`${ICONS}/folder.svg`).size(16).flex_none())
    .child(div().flex_1().min_w(0).truncate().text_size(13).font_semibold().child(p.id))
    .child(div().flex_none().text_size(12).text_color(t.dim).child(String(count)))
    .child(roundButton(t, `new-${p.id}`, `${ICONS}/plus.svg`, 28, (cx) => { v.newChat(p.id, cx); cx.notify(); }));
}

/** The whole sidebar card. @param {any} v @param {Theme} t */
export function treeView(v, t) {
  const recent = v.recentIds().map((id) => chatRow(v, t, v.chat(id), `r:${id}`));
  const groups = v.projects.map((/** @type {any} */ p) => {
    const chats = v.chatsIn(p.id);
    return v_flex().gap(2)
      .child(projectRow(v, t, p, chats.length))
      .when(!v.collapsed[p.id], (el) => el.child(v_flex().gap(2).pl(10).children(chats.map((c) => chatRow(v, t, c, `c:${c.id}`)))));
  });

  const lit = v.zone === "tree" || v.zone === "search";
  return v_flex().id("tree").relative().w(TREE_WIDTH).flex_none().h_full().rounded(14).border_1().border_color(lit ? focusBorder(t) : t.border).bg(t.background)
    // Title and new chat.
    .child(h_flex().flex_none().items_center().justify_between().pl(20).pr(14).pt(16).pb(10)
      .child(div().text_size(20).font_bold().text_color(t.foreground).child("Hey, chat"))
      .child(roundButton(t, "new-here", `${ICONS}/pencil.svg`, 36, (cx) => { v.newChat(v.chat(v.chatId).project, cx); cx.notify(); })))
    // Search. Filtering comes with existing sessions (A6).
    .child(div().flex_none().px(14).pb(8)
      .child(h_flex().h(36).px(12).gap(8).items_center().rounded_full().bg(t.raised).border_1().border_color(t.border)
        .child(svg(`${ICONS}/search.svg`).size(15).flex_none().text_color(t.dim))
        .child(Input.new(v.searchInput).flex_1().text_size(13.5).text_color(t.foreground))))
    // Recent, then the projects.
    .child(v_flex().id("tree-scroll").flex_1().min_h(0).overflow_y_scrollbar().px(8).pb(8).gap(6)
      .child(v_flex().gap(2).pb(6).border_b_1().border_color(t.border)
        .child(h_flex().h(30).px(8).gap(8).items_center().text_color(t.muted)
          .child(svg(`${ICONS}/clock.svg`).size(15))
          .child(div().text_size(13).font_semibold().child("Recent")))
        .children(recent))
      .children(groups))
    // The tree's keys, while it has the keyboard.
    .when(v.zone === "tree", (el) => el.child(div().flex_none().px(16).pt(8).pb(4).child(legend(t, TREE_HINTS))))
    // Your picture and the settings gear: a click opens or closes Settings.
    .child(h_flex().id("me-row").flex_none().mx(8).my(8).px(10).py(8).gap(10).items_center().rounded(12)
      .cursor_pointer().hover((s) => s.bg(t.hover))
      .when(v.settingsOpen, (el) => el.bg(t.hover))
      .on_click((_e, cx) => { v.toggleSettings(); cx.notify(); })
      .child(myPicture(v.me, 36))
      .child(div().flex_1())
      .child(svg("mods/hey-chat/kit/gear.svg").size(19).text_color(v.settingsOpen ? t.foreground : t.muted)))
    .when(v.settingsOpen, (el) => el.child(settingsView(v, t)));
}
