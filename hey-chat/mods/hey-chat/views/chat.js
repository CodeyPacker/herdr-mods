// The chat card: the header, the messages, and the message box.
import { div, svg } from "gpui-kit";
import { h_flex, v_flex, Input, TextView } from "gpui-base";
import { settings } from "herdr";
import { AGENTS, agentPicture, myPicture, withDot } from "../pictures.js";
import { roundButton, focusBorder } from "./tree.js";
import { LIST_PAD_TOP, LIST_PAD_BOTTOM } from "../keys.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @typedef {import("../messages.js").Message} Message */

const ICONS = "mods/hey-chat/icons";

/** Bubble corners: 18 px, and 5 px on the side that joins the next or last bubble of the same sender. */
const ROUND = 18, JOINED = 5;
/** The space between groups, and between bubbles in one group. */
const GROUP_GAP = 14, BUBBLE_GAP = 2;
/** A small picture beside a group's last bubble. */
const SMALL = 28;

/** True when `a` and `b` come from the same sender, so they sit in one group. @param {Message} a @param {Message} [b] */
function sameSender(a, b) {
  return Boolean(b) && a.kind !== "sep" && b.kind !== "sep" && a.from === b.from;
}

/**
 * Rounds a bubble: 18 px corners, 5 px on the joined side.
 * @param {any} el @param {boolean} mine @param {boolean} joinedAbove @param {boolean} joinedBelow
 */
function corners(el, mine, joinedAbove, joinedBelow) {
  return mine
    ? el.rounded_tl(ROUND).rounded_bl(ROUND).rounded_tr(joinedAbove ? JOINED : ROUND).rounded_br(joinedBelow ? JOINED : ROUND)
    : el.rounded_tr(ROUND).rounded_br(ROUND).rounded_tl(joinedAbove ? JOINED : ROUND).rounded_bl(joinedBelow ? JOINED : ROUND);
}

/** The monospace font: the terminal's. */
function mono() {
  return String(settings().font_family ?? "Menlo");
}

/** A tool call: icon, title, +/− counts and a chevron. A click shows its files or command. @param {any} v @param {Theme} t @param {Message} m @param {any} el */
function toolCard(v, t, m, el) {
  const open = v.openTools.has(m.id);
  const icon = { file: "file", edit: "edit", run: "run" }[m.icon ?? "file"] ?? "file";
  return el.id(`tool-${m.id}`).w(340).flex_none().p(10).bg(t.raised).border_1().border_color(t.border).cursor_pointer()
    .hover((s) => s.bg(t.hover))
    .on_click((_e, cx) => { open ? v.openTools.delete(m.id) : v.openTools.add(m.id); cx.notify(); })
    .child(v_flex().w_full().gap(8)
      .child(h_flex().gap(10).items_center()
        .child(h_flex().flex_none().size(26).rounded(8).bg(t.hover).items_center().justify_center()
          .child(svg(`${ICONS}/${icon}.svg`).size(14).text_color(t.muted)))
        .child(div().flex_1().min_w(0).truncate().text_size(13.5).font_medium().text_color(t.foreground).child(m.title ?? ""))
        .when(Boolean(m.add), (row) => row.child(h_flex().flex_none().gap(6).text_size(12).font_family(mono())
          .child(div().text_color(t.ansi2).child(m.add ?? ""))
          .child(div().text_color(t.ansi1).child(m.del ?? ""))))
        .child(svg(`${ICONS}/${open ? "chevron-down" : "chevron"}.svg`).size(14).flex_none().text_color(t.muted)))
      .when(open, (col) => col.child(v_flex().gap(4).px(10).py(8).rounded(8).bg(t.background)
        .children((m.lines ?? []).map((line) => div().truncate().text_size(12).font_family(mono()).text_color(t.muted).child(line))))));
}

/** A code card: the language and a copy button over a monospace block. @param {Theme} t @param {Message} m @param {any} el @param {number} max */
function codeCard(t, m, el, max) {
  return el.min_w(360).max_w(max).overflow_hidden().bg(t.raised)
    .child(v_flex().w_full()
      .child(h_flex().pl(14).pr(6).py(5).items_center().justify_between().border_b_1().border_color(t.border)
        .child(div().text_size(11.5).font_family(mono()).text_color(t.muted).child(m.lang ?? ""))
        .child(roundButton(t, `copy-${m.id}`, `${ICONS}/copy.svg`, 26, () => {})))
      .child(v_flex().px(14).py(12).bg(t.background).text_size(12.5).font_family(mono()).text_color(t.foreground)
        .children(String(m.text ?? "").split("\n").map((line) => div().whitespace_nowrap().child(line || " ")))));
}

/** A permission card's word for how it was answered, and its color. @param {Theme} t @param {string} state */
function answered(t, state) {
  if (state === "allowed") return { text: "Allowed once", color: t.done };
  if (state === "always") return { text: "Always allowed", color: t.done };
  if (state === "denied") return { text: "Denied", color: t.muted };
  return { text: "Waiting for you", color: t.blocked };
}

/** A small pill button. @param {Theme} t @param {string} id @param {string} key @param {string} label @param {boolean} main @param {(cx: any) => void} click */
export function pill(t, id, key, label, main, click) {
  return h_flex().id(id).flex_none().h(30).px(12).gap(6).items_center().rounded_full().cursor_pointer().text_size(12.5).font_medium()
    .bg(main ? t.accent : t.raised).text_color(main ? t.accent_foreground : t.foreground)
    .when(!main, (el) => el.border_1().border_color(t.border).hover((s) => s.bg(t.hover)))
    .on_click((_e, cx) => { click(cx); cx.notify(); })
    .child(div().font_semibold().opacity(0.7).child(key)).child(label);
}

/**
 * A permission card: what the agent wants to do, the command or diff, and how it was answered.
 * A pending card has the three answers as buttons too.
 * @param {any} v @param {Theme} t @param {any} m @param {any} el @param {number} max
 */
function askCard(v, t, m, el, max) {
  const a = answered(t, m.state);
  const pending = m.state === "pending";
  const lines = (m.lines ?? []).map((/** @type {string} */ line) => div().whitespace_nowrap().overflow_hidden()
    .text_color(line.startsWith("+ ") ? t.ansi2 : line.startsWith("- ") ? t.ansi1 : t.muted).child(line || " "));
  return el.max_w(max).min_w(320).p(12).bg(t.raised).border_1().border_color(pending ? t.blocked : t.border)
    .child(v_flex().w_full().gap(10)
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().min_w(0).text_size(13.5).text_color(t.foreground)
          .child(`${v.chatAgentName()} wants to ${m.title.charAt(0).toLowerCase()}${m.title.slice(1)}`))
        .child(div().flex_none().text_size(12).font_medium().text_color(a.color).child(a.text)))
      .when(lines.length > 0, (col) => col.child(v_flex().px(10).py(8).rounded(8).bg(t.background).text_size(12).font_family(mono()).children(lines)))
      .when(pending, (col) => col.child(h_flex().gap(8)
        .child(pill(t, `allow-${m.id}`, "y", "Allow once", true, (cx) => v.decide("allow", false, cx)))
        .child(pill(t, `always-${m.id}`, "a", "Always allow", false, (cx) => v.decide("allow", true, cx)))
        .child(pill(t, `deny-${m.id}`, "n", "Deny", false, (cx) => v.decide("deny", false, cx))))));
}

/**
 * One message row, with its picture slot and the space above it.
 * @param {any} v @param {Theme} t @param {Message[]} list @param {number} i @param {number} max a bubble's widest
 */
function messageRow(v, t, list, i, max) {
  const m = list[i];
  if (m.kind === "sep") {
    return h_flex().justify_center().pt(i === 0 ? 0 : 12).pb(6)
      .child(div().text_size(12).font_medium().text_color(t.dim).child(m.text ?? ""));
  }
  if (m.kind === "note") {
    return h_flex().justify_center().pt(GROUP_GAP).child(div().text_size(12).text_color(t.dim).child(m.text ?? ""));
  }
  const mine = m.from === "me";
  const typingHere = v.busy(v.chat(v.chatId));
  const above = sameSender(m, list[i - 1]);
  const below = sameSender(m, list[i + 1]) || (!mine && i === list.length - 1 && typingHere);
  const lastOfGroup = !sameSender(m, list[i + 1]);
  const chat = v.chat(v.chatId);

  let bubble = corners(div(), mine, above, below);
  if (m.kind === "tool") bubble = toolCard(v, t, m, bubble);
  else if (m.kind === "code") bubble = codeCard(t, m, bubble, max);
  else if (m.kind === "permission") bubble = askCard(v, t, m, bubble, max);
  else if (m.kind === "error") bubble = bubble.max_w(max).px(14).py(9).text_size(14).bg(t.raised).border_1().border_color(t.blocked)
    .text_color(t.foreground).child(m.text ?? "");
  // A real agent's words are Markdown: bold, lists, code and links.
  else if (!mine && chat.real) bubble = bubble.max_w(max).px(14).py(9).text_size(14.5).bg(t.raised).text_color(t.foreground)
    .child(TextView.markdown(`md-${m.id}`, m.text ?? "").selectable(true));
  else bubble = bubble.max_w(max).px(14).py(9).text_size(14.5).line_height(1.42)
    .bg(mine ? t.accent : t.raised).text_color(mine ? t.accent_foreground : t.foreground).child(m.text ?? "");

  const picture = div().flex_none().size(SMALL)
    .when(lastOfGroup, (el) => el.child(mine ? myPicture(v.me, SMALL) : agentPicture(chat.agent, SMALL)));

  const row = h_flex().w_full().gap(8).items_end().pt(i === 0 ? 0 : above ? BUBBLE_GAP : GROUP_GAP)
    .when(mine, (el) => el.justify_end().child(bubble).child(picture))
    .when(!mine, (el) => el.child(picture).child(bubble));

  // The receipt under your last message, when nothing came after it.
  if (!mine || i !== list.length - 1) return row;
  const receipt = typingHere ? `Read ${m.time ?? ""}`.trim() : "Delivered";
  return v_flex().w_full().child(row)
    .child(h_flex().justify_end().pr(SMALL + 8).pt(4).child(div().text_size(11.5).text_color(t.dim).child(receipt)));
}

/** The agent's three dots while it works. Herdr animates them, so they cost no redraws. @param {any} v @param {Theme} t */
function typingRow(v, t) {
  const chat = v.chat(v.chatId);
  return h_flex().w_full().gap(8).items_end().pt(GROUP_GAP)
    .child(agentPicture(chat.agent, SMALL))
    .child(h_flex().h(38).px(16).items_center().rounded(19).bg(t.raised)
      .child(div().text_size(10).text_color(t.muted)
        .frames(["● ○ ○", "○ ● ○", "○ ○ ●"], 300).child("● ○ ○")));
}

/** An empty chat: the agent's picture, where it is, and the Claude / Codex switch. @param {any} v @param {Theme} t */
function emptyChat(v, t) {
  const chat = v.chat(v.chatId);
  const pick = (/** @type {string} */ id) => h_flex().id(`pick-${id}`).h(40).pl(8).pr(16).gap(8).items_center().rounded_full()
    .cursor_pointer().text_size(14).font_medium()
    .when(chat.agent === id, (el) => el.bg(t.selected).text_color(t.foreground))
    .when(chat.agent !== id, (el) => el.text_color(t.muted).hover((s) => s.bg(t.hover)))
    .on_click((_e, cx) => { chat.agent = id; cx.notify(); })
    .child(agentPicture(id, 26)).child(AGENTS[id].name);
  return v_flex().flex_1().items_center().justify_center().gap(14)
    .child(agentPicture(chat.agent, 72))
    .child(v_flex().items_center().gap(4)
      .child(div().text_size(18).font_semibold().text_color(t.foreground).child(`New chat in ${chat.project}`))
      .child(div().text_size(13.5).text_color(t.muted).child("Pick who you're talking to, then send your first message.")))
    .child(h_flex().p(4).gap(4).rounded_full().bg(t.raised).border_1().border_color(t.border)
      .child(pick("claude")).child(pick("codex")));
}

/** A message row that reports its height for the scroll keys. @param {any} v @param {string} id @param {string} key @param {any} row */
function measured(v, id, key, row) {
  return row.id(id).on_size_change((size) => { v.rowHeights.set(key, size.height); });
}

/** The whole chat card. @param {any} v @param {Theme} t @param {number} width the card's width */
export function chatView(v, t, width) {
  const chat = v.chat(v.chatId);
  const agent = AGENTS[chat.agent] ?? AGENTS.claude;
  const project = v.project(chat.project);
  const ask = v.waiting(chat);
  const typingHere = v.busy(chat) && !ask;
  const statusColor = ask ? t.blocked : typingHere ? t.working : t.done;
  const status = ask ? "Waiting for you" : typingHere ? "Thinking\u2026" : chat.loading ? "Loading\u2026" : "Ready";
  const max = Math.max(240, Math.round((width - 40) * 0.62));
  const list = chat.thread;
  const input = v.inputFor(chat.agent);
  const hasText = input.value().trim().length > 0;

  const header = h_flex().flex_none().gap(12).items_center().pl(18).pr(12).py(12).border_b_1().border_color(t.border)
    .child(withDot(agentPicture(chat.agent, 40), 40, statusColor, t.background))
    .child(v_flex().flex_1().min_w(0).gap(2)
      .child(div().truncate().text_size(16).font_semibold().text_color(t.foreground).child(chat.title))
      .child(h_flex().gap(4).text_size(12.5)
        .child(div().text_color(t.muted).child(`${agent.name} ·`))
        .child(div().text_color(statusColor).child(status))))
    .child(h_flex().flex_none().gap(6).px(10).py(5).items_center().rounded(8).bg(t.raised).border_1().border_color(t.border)
      .text_size(12).font_family(mono()).text_color(t.muted)
      .child(svg(`${ICONS}/folder.svg`).size(13)).child(project?.path ?? chat.project))
    .child(roundButton(t, "chat-search", `${ICONS}/search.svg`, 36, () => {}))
    .child(roundButton(t, "chat-info", `${ICONS}/info.svg`, 36, () => {}))
    .child(roundButton(t, "chat-delete", `${ICONS}/trash.svg`, 36, () => v.askDelete(chat.id)));

  const body = list.length === 0 && (chat.session || chat.loading)
    ? v_flex().flex_1().items_center().justify_center().child(div().text_size(13).text_color(t.dim).child(chat.loading ? "Loading\u2026" : "No messages to show."))
    : list.length === 0
    ? emptyChat(v, t)
    : v_flex().id("messages").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(v.scroll)
      .px(20).pt(LIST_PAD_TOP).pb(LIST_PAD_BOTTOM)
      // The keys' scroll position (keys.js scrollChat) follows the wheel too. Its sign: a wheel
      // turned toward you scrolls down, and GPUI reports that as a negative y.
      .on_size_change((size) => { v.viewH = size.height; })
      .on_scroll_wheel((e) => {
        const dy = e.delta_lines ? e.delta_lines.y * 20 : e.delta.y;
        v.top -= dy; v.atBottom = false;
      })
      .children(list.map((m, i) => measured(v, `row-${m.id}`, m.id, messageRow(v, t, list, i, max))))
      .when(typingHere, (el) => el.child(measured(v, "row-typing", "typing", typingRow(v, t))));

  // While a permission card waits, the message box gives way to its question and answers.
  const askBar = ask && h_flex().flex_none().gap(10).items_center().mx(14).mt(10).mb(14).pl(16).pr(8).py(8).rounded(16)
    .bg(t.raised).border_1().border_color(t.blocked)
    .child(div().flex_1().min_w(0).truncate().text_size(13.5).text_color(t.foreground)
      .child(`${agent.name} wants to ${ask.title.charAt(0).toLowerCase()}${ask.title.slice(1)}`))
    .child(pill(t, "bar-allow", "y", "Allow once", true, (cx) => v.decide("allow", false, cx)))
    .child(pill(t, "bar-always", "a", "Always allow", false, (cx) => v.decide("allow", true, cx)))
    .child(pill(t, "bar-deny", "n", "Deny", false, (cx) => v.decide("deny", false, cx)));

  const working = v.busy(chat);
  const composer = askBar || h_flex().flex_none().gap(8).items_center().px(14).pt(10).pb(14)
    .child(roundButton(t, "attach", `${ICONS}/plus.svg`, 36, () => {}))
    .child(h_flex().flex_1().h(42).px(16).items_center().rounded_full().bg(t.raised).border_1().border_color(t.border)
      .child(Input.new(input).flex_1().text_size(14.5).text_color(t.foreground))
      .child(h_flex().flex_none().gap(4).items_center().text_size(11.5)
        .child(div().text_color(t.accent).font_semibold().child("⌃j ⌃k"))
        .child(div().text_color(t.dim).child(working && chat.real ? "scroll \u00b7 \u2303c stop" : "scroll"))))
    // Send, or stop (ctrl-c) while the agent works.
    .child(working && chat.real
      ? h_flex().id("stop").flex_none().size(36).rounded_full().items_center().justify_center().cursor_pointer()
        .bg(t.raised).border_1().border_color(t.border).text_color(t.foreground).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { v.stop(); cx.notify(); })
        .child(svg(`${ICONS}/stop.svg`).size(16))
      : h_flex().id("send").flex_none().size(36).rounded_full().items_center().justify_center()
        .bg(hasText ? t.accent : t.hover).text_color(hasText ? t.accent_foreground : t.dim)
        .when(hasText, (el) => el.cursor_pointer())
        .on_click((_e, cx) => { v.send(cx); cx.notify(); })
        .child(svg(`${ICONS}/send.svg`).size(18)));

  return v_flex().id("chat").flex_1().min_w(0).h_full().rounded(14).border_1().border_color(v.zone === "chat" ? focusBorder(t) : t.border).bg(t.background).overflow_hidden()
    .child(header).child(body).child(composer);
}
