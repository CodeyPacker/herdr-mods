// The chat card: the header, the messages, and the message box.
import { div, svg, image } from "gpui-kit";
import { h_flex, v_flex, Input, Textarea, TextView } from "gpui-base";
import { settings, window } from "herdr";
import { AGENTS, agentPicture, myPicture, withDot } from "../pictures.js";
import { roundButton } from "./tree.js";
import { focusBorder } from "../kit/theme.js";
import { ICONS } from "../common.js";
import { LIST_PAD_TOP, LIST_PAD_BOTTOM } from "../keys.js";
import { outputToast } from "./outputs.js";
import { currentActivity } from "../messages.js";
import { messageColors } from "../message-colors.js";
import { markedText, markedMarkdown } from "../search.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @typedef {import("../messages.js").Message} Message */


/** Bubble corners: 18 px, and 5 px on the side that joins the next or last bubble of the same sender. */
const ROUND = 18, JOINED = 5;
/** The space between groups, and between bubbles in one group. */
const GROUP_GAP = 14, BUBBLE_GAP = 4;
/** A small picture beside a group's last bubble. */
const SMALL = 28;

/**
 * The message box's text size. On Windows 14.5 gives lines a fraction of a pixel tall, so at two
 * lines the box counts its text as taller than itself and scrolls it by a pixel on every key.
 * 15 gives whole-pixel lines.
 */
function boxTextSize() {
  // There is no window while `herdr-app check` renders.
  return window()?.platform === "windows" ? 15 : 14.5;
}

/** True when `a` and `b` come from the same sender, so they sit in one group. @param {Message} a @param {Message} [b] */
function sameSender(a, b) {
  return Boolean(b) && a.kind !== "sep" && b.kind !== "sep" && a.from === b.from && a.source?.chat === b.source?.chat;
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

/** Underline search matches without changing their text color. */
function searchText(v, id, text) {
  const query = v.chatSearchOpen ? v.chatSearchInput.value().trim() : "";
  if (!query || !String(text ?? "").toLowerCase().includes(query.toLowerCase())) return String(text ?? "");
  return TextView.html(id, markedText(text, query).replace(/\n/g, "<br>")).selectable(true);
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
        .child(div().flex_1().min_w(0).truncate().text_size(13.5).font_medium().text_color(t.foreground).child(searchText(v, `tool-title-${m.id}`, m.title)))
        .when(Boolean(m.add), (row) => row.child(h_flex().flex_none().gap(6).text_size(12).font_family(mono())
          .child(div().text_color(t.ansi2).child(m.add ?? ""))
          .child(div().text_color(t.ansi1).child(m.del ?? ""))))
        .child(svg(`${ICONS}/${open ? "chevron-down" : "chevron"}.svg`).size(14).flex_none().text_color(t.muted)))
      .when(open, (col) => col.child(v_flex().gap(4).px(10).py(8).rounded(8).bg(t.background)
        .children((m.lines ?? []).map((line, i) => div().truncate().text_size(12).font_family(mono()).text_color(t.muted).child(searchText(v, `tool-line-${m.id}-${i}`, line)))))));
}

/** The biggest a picture in the chat is drawn. */
const PICTURE_MAX = 280;

/** An image's drawn size: its own shape, fitted inside `max` px. @param {any} m @param {number} max */
function fit(m, max) {
  const w = Number(m.w) || max, h = Number(m.h) || Math.round(max * 0.75);
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(24, Math.round(w * k)), h: Math.max(24, Math.round(h * k)) };
}

/** A picture in the chat. A click shows it big. @param {any} v @param {Theme} t @param {any} m @param {any} el */
function pictureBubble(v, t, m, el) {
  const { w, h } = fit(m, PICTURE_MAX);
  return el.id(`img-${m.id}`).flex_none().w(w).h(h).overflow_hidden().bg(t.raised).border_1().border_color(t.border)
    .cursor_pointer().on_click((_e, cx) => { v.viewing = { path: m.path, w: m.w, h: m.h }; cx.notify(); })
    .child(image(m.path).w(w).h(h));
}

/** The image shown big over the whole pane. A click or esc closes it. @param {any} v */
export function imageViewer(v) {
  const img = v.viewing;
  const w0 = Number(img.w) || 800, h0 = Number(img.h) || 600;
  const k = Math.min(1, (v.width - 64) / w0, (v.height - 64) / h0);
  const w = Math.max(24, Math.round(w0 * k)), h = Math.max(24, Math.round(h0 * k));
  return h_flex().id("image-viewer").absolute().top(0).left(0).size_full().items_center().justify_center()
    .bg("#000000d9").cursor_pointer()
    .on_click((_e, cx) => { v.viewing = null; cx.notify(); })
    .child(div().w(w).h(h).rounded(10).overflow_hidden().child(image(img.path).w(w).h(h)));
}

/** Opens the original saved file, including PDFs that the agent reads with its tools. */
export function documentCard(v, t, file) {
  const size = file.bytes >= 1024 ? `${Math.ceil(file.bytes / 1024)} KB` : `${file.bytes ?? 0} bytes`;
  return h_flex().id(`document-${file.path}`).flex_1().min_w(0).gap(8).items_center().cursor_pointer()
    .on_click((_e, cx) => { v.openDocument(file.path, cx); cx.notify(); })
    .child(svg(`${ICONS}/file.svg`).flex_none().size(18).text_color(t.muted))
    .child(v_flex().flex_1().min_w(0).gap(3)
      .child(div().truncate().text_size(13).text_color(t.foreground).child(file.name))
      .child(div().text_size(11).text_color(t.muted).child(`${file.format === 'pdf' ? 'PDF' : 'Text'} · ${size}`)));
}

/**
 * The images you pasted, above the message box, each with a button that takes it back out.
 * @param {any} v @param {Theme} t @param {any} chat
 */
function attachments(v, t, chat) {
  const list = chat.attached ?? [];
  return h_flex().flex_none().flex_wrap().max_h(160).overflow_y_scrollbar().gap(8).px(14).pt(10).items_end()
    .children(list.map((/** @type {any} */ img, /** @type {number} */ i) => {
      if (img.kind === "document") return h_flex().flex_none().w(220).p(8).gap(6).items_center().rounded(10).border_1().border_color(t.border)
        .child(documentCard(v, t, img))
        .child(div().id(`unattach-${i}`).flex_none().size(20).cursor_pointer()
          .on_click((_e, cx) => { v.unattach(img.path); cx.notify(); })
          .child(svg(`${ICONS}/close.svg`).size(14).text_color(t.muted)));
      const { w, h } = fit(img, 72);
      return div().relative().flex_none().w(w).h(h).rounded(10).overflow_hidden().border_1().border_color(t.border)
        .child(image(img.path).w(w).h(h))
        .child(h_flex().id(`unattach-${i}`).absolute().top(3).right(3).size(18).rounded_full().items_center().justify_center()
          .cursor_pointer().bg("#000000aa").text_color("#ffffff").hover((s) => s.bg("#000000dd"))
          .on_click((_e, cx) => { v.unattach(img.path); cx.notify(); })
          .child(svg(`${ICONS}/close.svg`).size(10)));
    }))
    .when(Boolean(chat.pasteError), (el) => el.child(div().text_size(12).text_color(t.dim).child(chat.pasteError ?? "")));
}

/**
 * The agent's questions for you: each question with its options as buttons (1 to 9 pick them
 * while the box is empty). Typing in the box and pressing enter answers the next question in your
 * own words. Several questions, or one with several picks, wait for Send.
 * @param {any} v @param {Theme} t @param {any} m @param {any} el @param {number} max
 */
export function questionCard(v, t, m, el, max) {
  const pending = m.state === "pending" && !m.sending;
  const next = pending ? v.nextQuestion(m) : null;
  const needsSend = m.questions.length > 1 || m.questions.some((/** @type {any} */ q) => q.multi);
  const done = m.state === "answered" ? { text: "Answered", color: t.done } : m.state === "dismissed" ? { text: "Dismissed", color: t.muted } : { text: "Waiting for you", color: t.blocked };
  const question = (/** @type {any} */ q, /** @type {number} */ qi) => {
    const picks = m.picks[q.id] ?? [];
    const typed = picks.filter((/** @type {string} */ p) => !(q.options ?? []).some((/** @type {any} */ o) => o.label === p));
    return v_flex().gap(8)
      .child(h_flex().gap(8).items_center()
        .when(Boolean(q.header), (row) => row.child(div().flex_none().px(8).py(2).rounded_full().bg(t.hover).text_size(11.5).font_medium().text_color(t.muted).child(q.header)))
        .child(div().flex_1().min_w(0).text_size(13.5).text_color(t.foreground).child(searchText(v, `question-text-${m.id}-${qi}`, q.question + (q.multi ? " (pick any)" : "")))))
      .child(v_flex().gap(6).children((q.options ?? []).map((/** @type {any} */ o, /** @type {number} */ oi) => {
        const on = picks.includes(o.label);
        return h_flex().id(`q-${m.id}-${qi}-${oi}`).w_full().px(10).py(7).gap(10).items_center().rounded(10).border_1()
          .border_color(on ? t.accent : t.border).bg(on ? t.selected : t.background)
          .when(pending, (row) => row.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => { v.pickAnswer(m, q, o.label, cx); cx.notify(); }))
          .when(pending && v.keyHints && q === next && oi < 9, (row) => row.child(div().flex_none().w(14).text_size(12).font_semibold().text_color(t.accent).child(String(oi + 1))))
          .child(v_flex().flex_1().min_w(0)
            .child(div().text_size(13).font_medium().text_color(t.foreground).child(o.label))
            .when(Boolean(o.description), (col) => col.child(div().text_size(12).text_color(t.dim).child(o.description))));
      })))
      .when(typed.length > 0, (col) => col.child(div().text_size(12.5).text_color(t.muted).child(`Your answer: ${typed.join(", ")}`)));
  };
  return el.max_w(max).min_w(320).p(12).bg(t.raised).border_1().border_color(pending ? t.blocked : t.border)
    .child(v_flex().w_full().gap(12)
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().min_w(0).text_size(13.5).font_medium().text_color(t.foreground).child(`${v.chatAgentName()} has ${m.questions.length === 1 ? "a question" : `${m.questions.length} questions`}`))
        .child(div().flex_none().text_size(12).font_medium().text_color(done.color).child(done.text)))
      .children(m.questions.map(question))
      .when(Boolean(m.error), (col) => col.child(div().text_size(12).text_color(t.blocked).child(m.error)))
      .when(pending, (col) => col.child(h_flex().gap(8).items_center()
        .when(needsSend && v.answeredAll(m), (row) => row.child(pill(t, `qsend-${m.id}`, null, "Send answers", true, (cx) => v.sendAnswers(m, cx))))
        .child(pill(t, `qskip-${m.id}`, null, "Dismiss", false, (cx) => v.dismissQuestion(m, cx)))
        .child(div().text_size(12).text_color(t.dim).child("Or type your own answer below.")))));
}

/** How many rows the / menu shows at once. */
const SLASH_ROWS = 8;

/**
 * The / menu above the message box: the agent's skills, each with what it does.
 * The lit row is the one tab or enter picks. @param {any} v @param {Theme} t @param {any[]} items
 */
function slashMenu(v, t, items) {
  const lit = Math.min(v.slashIndex, Math.max(0, items.length - 1));
  // The rows shown: a window that keeps the lit one in view.
  const first = Math.max(0, lit - SLASH_ROWS + 1);
  const shown = items.slice(first, first + SLASH_ROWS);
  const rows = shown.map((item, k) => {
    const i = first + k;
    return h_flex().id(`slash-${item.name}`).w_full().h(34).px(12).gap(10).items_center().rounded(8).cursor_pointer()
      .when(i === lit, (el) => el.bg(t.hover))
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { v.pickSlash(item); cx.notify(); })
      .child(div().flex_none().text_size(13.5).font_semibold().text_color(t.foreground).child(`/${item.name}`))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.dim).child(item.description ?? ""));
  });
  const empty = items.length === 0
    ? div().px(12).py(8).text_size(12.5).text_color(t.dim).child(v.skillsLoading() ? "Loading skills\u2026" : "No matching skills.")
    : null;
  return v_flex().flex_none().mx(14).mt(10).p(6).gap(2).rounded(12).bg(t.raised).border_1().border_color(t.border)
    .children(rows)
    .when(Boolean(empty), (el) => el.child(empty))
    .when(v.skillsLoading() && items.length > 0, (el) => el.child(div().px(12).py(4).text_size(12).text_color(t.dim).child("Loading skills\u2026")));
}

/** A permission card's word for how it was answered, and its color. @param {Theme} t @param {string} state */
function answered(t, state) {
  if (state === "allowed") return { text: "Allowed once", color: t.done };
  if (state === "always") return { text: "Always allowed", color: t.done };
  if (state === "denied") return { text: "Denied", color: t.muted };
  return { text: "Waiting for you", color: t.blocked };
}

/** A small pill button, with its key in front unless `key` is null. @param {Theme} t @param {string} id @param {string | null} key @param {string} label @param {boolean} main @param {(cx: any) => void} click */
export function pill(t, id, key, label, main, click) {
  return h_flex().id(id).flex_none().h(30).px(12).gap(6).items_center().rounded_full().cursor_pointer().text_size(12.5).font_medium()
    .bg(main ? t.accent : t.raised).text_color(main ? t.accent_foreground : t.foreground)
    .when(!main, (el) => el.border_1().border_color(t.border).hover((s) => s.bg(t.hover)))
    .on_click((_e, cx) => { click(cx); cx.notify(); })
    .when(Boolean(key), (el) => el.child(div().font_semibold().opacity(0.7).child(key ?? "")))
    .child(label);
}

/** "Claude wants to run ls": a permission card's question. @param {string} agent @param {string} title */
function wantsTo(agent, title) {
  return `${agent} wants to ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
}

/**
 * The copy button beside a message. Its room is kept when it's hidden, so the bubble never moves.
 * It shows while the pointer is over the message (actions/copy.js), and as a check once copied.
 * @param {any} v @param {Theme} t @param {Message} m
 */
function copyButton(v, t, m) {
  const copied = v.copied?.id === m.id;
  const shown = copied || v.copyFor === m.id;
  return div().flex_none().size(26).when(shown, (el) => el.child(h_flex().id(`copy-${m.id}`).size(26).rounded_full().items_center().justify_center()
    .cursor_pointer().text_color(copied ? t.done : t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
    .on_click((_e, cx) => { v.copyMessage(m, cx); cx.notify(); })
    .child(svg(`${ICONS}/${copied ? "check" : "copy"}.svg`).size(14))));
}

/**
 * The key hints inside the message box: each key in the accent color, then what it does. Hints
 * whose key is off or hidden are left out. @param {Theme} t @param {string[][]} hints [key, what] each
 */
function boxHints(t, hints) {
  return h_flex().flex_none().gap(8).items_center().text_size(11.5).children(hints.filter(([key]) => key).map(([key, what]) =>
    h_flex().gap(4).items_center()
      .child(div().text_color(t.accent).font_semibold().child(key))
      .child(div().text_color(t.dim).child(what))));
}

/**
 * The three answers to a permission card as pill buttons, with their keys when key hints show.
 * @param {any} v @param {Theme} t @param {(answer: string) => string} id each button's element id
 */
function askButtons(v, t, id) {
  return [
    pill(t, id("allow"), v.keyHint("allow") || null, "Allow once", true, (cx) => v.decide("allow", false, cx)),
    pill(t, id("always"), v.keyHint("always") || null, "Always allow", false, (cx) => v.decide("allow", true, cx)),
    pill(t, id("deny"), v.keyHint("deny") || null, "Deny", false, (cx) => v.decide("deny", false, cx)),
  ];
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
        .child(div().flex_1().min_w(0).text_size(13.5).text_color(t.foreground).child(wantsTo(v.chatAgentName(), m.title)))
        .child(div().flex_none().text_size(12).font_medium().text_color(a.color).child(a.text)))
      .when(lines.length > 0, (col) => col.child(v_flex().px(10).py(8).rounded(8).bg(t.background).text_size(12).font_family(mono()).children(lines)))
      .when(Boolean(m.error), (col) => col.child(div().text_size(12).text_color(t.blocked).child(m.error)))
      .when(pending, (col) => col.child(h_flex().gap(8).children(askButtons(v, t, (answer) => `${answer}-${m.id}`))))
      // What "Always allow" would cover, so nobody allows more than they meant to.
      .when(pending && Boolean(m.covers), (col) => col.child(div().text_size(12).text_color(t.dim).child(m.covers))));
}

/**
 * One message row, with its picture slot and the space above it.
 * @param {any} v @param {Theme} t @param {Message[]} list @param {number} i @param {number} max a bubble's widest
 */
export function messageRow(v, t, list, i, max, searchCurrent = false, palette = messageColors(t)) {
  const m = list[i];
  if (m.kind === "sep") {
    return h_flex().justify_center().pt(i === 0 ? 0 : 12).pb(6)
      .child(div().text_size(12).font_medium().text_color(t.dim).child(m.text ?? ""));
  }
  if (m.kind === "note") {
    return h_flex().justify_center().pt(GROUP_GAP).child(div().text_size(12).text_color(t.dim).child(m.text ?? ""));
  }
  const mine = m.from === "me" && !m.source;
  const background = mine ? palette.userBackground : palette.agentBackground;
  const foreground = mine ? palette.userText : palette.agentText;
  const typingHere = v.thinking(v.chat(v.chatId));
  const above = sameSender(m, list[i - 1]);
  const below = sameSender(m, list[i + 1]) || (!mine && !m.source && i === list.length - 1 && typingHere);
  const firstOfGroup = !above;
  const chat = v.chat(v.chatId);

  let bubble = corners(div(), mine, above, below);
  if (m.kind === "tool") bubble = toolCard(v, t, m, bubble);
  else if (m.kind === "permission") bubble = askCard(v, t, m, bubble, max);
  else if (m.kind === "question") bubble = questionCard(v, t, m, bubble, max);
  else if (m.kind === "file") bubble = bubble.w(260).max_w(max).p(12).bg(t.raised).border_1().border_color(t.border).child(documentCard(v, t, m));
  else if (m.kind === "image") bubble = pictureBubble(v, t, m, bubble);
  else if (m.kind === "error") bubble = bubble.max_w(max).px(14).py(9).text_size(14).bg(t.raised).border_1().border_color(t.blocked)
    .text_color(t.foreground).child(searchText(v, `error-${m.id}`, m.text));
  // A real agent's words are Markdown: bold, lists, code and links.
  else if (!mine && chat.real) bubble = bubble.max_w(max).px(14).py(9).text_size(14.5).bg(background).text_color(foreground)
    .child(TextView.markdown(`md-${m.id}`, markedMarkdown(m.text ?? "", v.chatSearchOpen ? v.chatSearchInput.value() : "")).text_color(foreground).selectable(true));
  else bubble = bubble.max_w(max).px(14).py(9).text_size(14.5).line_height(1.42)
    .bg(background).text_color(foreground).child(searchText(v, `text-${m.id}`, m.text));

  if (searchCurrent) {
    const yellow = String(t.ansi3);
    bubble = bubble.border_1().border_color(/^#[0-9a-f]{6}/i.test(yellow) ? `${yellow.slice(0, 7)}66` : t.ansi3);
  }

  const picture = div().flex_none().size(SMALL)
    .when(firstOfGroup, (el) => el.child(m.source ? agentPicture(m.source.agent ?? chat.agent, SMALL) : mine ? myPicture(v.me, SMALL) : agentPicture(chat.agent, SMALL)));

  // Words can be copied: a button beside the bubble, on the side away from the picture.
  const copyable = m.kind === "text" || m.kind === "error";
  let row = h_flex().id(`msg-${m.id}`).w_full().gap(8).items_start().pt(i === 0 ? 0 : above ? BUBBLE_GAP : GROUP_GAP)
    .when(copyable, (el) => el.on_hover((/** @type {boolean} */ on, /** @type {any} */ cx) => v.hoverMessage(m.id, on, cx)))
    .when(mine, (el) => el.justify_end().when(copyable, (r) => r.child(copyButton(v, t, m))).child(bubble).child(picture))
    .when(!mine, (el) => el.child(picture).child(bubble).when(copyable, (r) => r.child(copyButton(v, t, m))));

  if (m.source) {
    const label = m.source.kind === "update" ? `Update from ${m.source.title}` : `From ${m.source.title}`;
    row = v_flex().w_full()
      .child(div().id(`message-source-${m.id}`).px(SMALL + 8).pt(6).text_size(11).text_color(t.accent).cursor_pointer()
        .on_click((_e, cx) => { v.openRelatedChat(m.source.chat, cx); cx.notify(); }).child(label))
      .child(row);
  }
  if (m.kind === "error" && m.retry && !m.retried) {
    const waiting = m.retrying || chat.working || chat.connecting || chat.reconnecting || chat.modelSaving;
    return v_flex().w_full().child(row)
      .child(div().id(`retry-turn-${m.id}`).pl(SMALL + 8).pt(5).text_size(12).text_color(waiting ? t.dim : t.accent)
        .when(!waiting, el => el.cursor_pointer().on_click((_e, cx) => { v.retryTurn(m.id, cx); cx.notify(); }))
        .child(m.retrying ? "Retrying…" : "Retry"))
      .when(Boolean(m.retryError), el => el.child(div().pl(SMALL + 8).pt(4).text_size(12).text_color(t.blocked).child(m.retryError)));
  }
  if (mine && m.queued && m.queueAction) return v_flex().w_full().child(row)
    .child(h_flex().justify_end().pr(SMALL + 8).pt(4).gap(10).items_center()
      .child(div().text_size(11.5).text_color(t.dim).child(m.sending ? m.queueOperation === "edit" ? "Updating…" : m.queueOperation === "remove" ? "Removing…" : "Sending…" : "Queued"))
      .child(div().id(`send-now-${m.queueId}`).text_size(11.5).text_color(t.accent)
        .when(!m.sending, el => el.cursor_pointer().on_click((_e, cx) => { v.sendQueuedNow(m.queueId, cx); cx.notify(); }))
        .child("Send now"))
      .children([['edit', 'Edit'], ['remove', 'Remove']].map(([action, label]) =>
        div().id(`${action}-queued-${m.queueId}`).text_size(11.5).text_color(t.accent)
          .when(!m.sending && !v.queueEdit?.saving, el => el.cursor_pointer().on_click((_e, cx) => {
            if (action === 'edit') v.editQueued(m.queueId);
            else v.changeQueued(m.queueId, 'remove', cx);
            cx.notify();
          })).child(label))))
    .when(Boolean(m.queueError), el => el.child(h_flex().justify_end().pr(SMALL + 8).pt(4)
      .child(div().text_size(11.5).text_color(t.blocked).child(m.queueError))));
  // The receipt under your last message, when nothing came after it.
  if (!mine || i !== list.length - 1) return row;
  const receipt = typingHere ? `Read ${m.time ?? ""}`.trim() : "Delivered";
  return v_flex().w_full().child(row)
    .child(h_flex().justify_end().pr(SMALL + 8).pt(4).child(div().text_size(11.5).text_color(t.dim).child(receipt)));
}

/** The agent's three dots while it works. Herdr animates them, so they cost no redraws. @param {any} v @param {Theme} t */
function typingRow(v, t) {
  const chat = v.chat(v.chatId);
  const activity = currentActivity(chat);
  return h_flex().w_full().gap(8).items_end().pt(GROUP_GAP)
    .child(agentPicture(chat.agent, SMALL))
    .child(h_flex().min_w(0).gap(10).px(16).py(10).items_center().rounded(19).bg(t.raised)
      .child(image(`${ICONS}/typing.gif`).id("typing-dots").flex_none().w(29).h(16))
      .when(Boolean(activity), el => el.child(div().min_w(0).text_size(12).text_color(t.dim).child(activity))));
}

/** How many plan steps the box shows at once. */
const PLAN_ROWS = 8;

/**
 * The agent's plan while it works: one row per step, a check when done, a spinning ring of dots
 * in the accent color on the step it is on. A long plan shows the rows around that step.
 * @param {Theme} t @param {{ text: string, status: string }[]} steps
 */
function planBox(t, steps) {
  const done = steps.filter((s) => s.status === "completed").length;
  const on = steps.findIndex((s) => s.status === "in_progress");
  const from = Math.max(0, Math.min((on < 0 ? done : on) - 2, steps.length - PLAN_ROWS));
  const shown = steps.slice(from, from + PLAN_ROWS);
  const mark = (/** @type {string} */ status) => status === "completed"
    ? svg(`${ICONS}/check.svg`).flex_none().size(14).text_color(t.done)
    : status === "in_progress"
      ? svg(`${ICONS}/spinner-dots.svg`).flex_none().size(14).text_color(t.accent).spin(1000)
      : div().flex_none().size(12).mx(1).rounded_full().border_1().border_color(t.dim);
  return v_flex().id("plan").flex_none().mx(14).mt(10).px(14).py(10).gap(6).rounded(12).bg(t.raised).border_1().border_color(t.border)
    .child(h_flex().gap(6).items_center().text_size(12)
      .child(div().font_semibold().text_color(t.muted).child("Plan"))
      .child(div().text_color(t.dim).child(`${done} of ${steps.length}`)))
    .children(shown.map((s, i) => h_flex().id(`plan-${from + i}`).min_w(0).gap(8).items_center().text_size(12.5)
      .child(mark(s.status))
      .child(div().min_w(0).truncate().text_color(s.status === "in_progress" ? t.foreground : s.status === "completed" ? t.dim : t.muted).child(s.text))))
    .when(steps.length > shown.length, (el) => el.child(div().text_size(11.5).text_color(t.dim).child(`${steps.length - shown.length} more`)));
}

export function summaryButton(v, t, chat) {
  const open = v.summaryFor === chat.id;
  return roundButton(t, "toggle-chat-summary", `${ICONS}/info.svg`, 32, cx => {
    v.summaryFor = open ? null : chat.id;
    if (!open) cx.spawn(async cx => v.refreshLinkedChats(cx));
  }).tooltip(open ? "Hide summary" : "Show summary")
    .when(open, el => el.bg(t.selected).text_color(t.accent));
}

/** Only the parent link stays visible; details are opened with the header's info button. */
export function linkedChatsView(v, t, chat) {
  const identity = chat.linkId ?? chat.id;
  const children = (v.chats ?? []).filter(c => c.parentId === identity);
  const parent = (v.chats ?? []).find(c => (c.linkId ?? c.id) === chat.parentId);
  const summary = chat.linkSummary?.summary;
  const open = v.summaryFor === chat.id;
  if (!chat.parentId && !open) return null;
  const item = (id, title, click) => div().id(id).text_size(12).text_color(t.accent).cursor_pointer()
    .on_click((_e, cx) => { click(cx); cx.notify(); }).child(title);
  return v_flex().id("linked-chats").flex_none().px(16).py(8).gap(7).border_b_1().border_color(t.border)
    .when(Boolean(chat.parentId), el => el.child(item("open-parent-chat", `Parent: ${parent?.title ?? 'Open parent chat'}`, cx => v.openRelatedChat(chat.parentId, cx)).min_w(0).truncate()))
    .when(open && Boolean(children.length), el => el.child(h_flex().flex_wrap().gap(10)
      .children(children.map(child => item(`open-child-${child.id}`, child.title, cx => v.openChat(child.id, cx))))))
    .when(open, el => el.child(v_flex().max_h(220).overflow_y_scrollbar().gap(5).text_size(12).text_color(t.muted)
      .child(div().font_semibold().text_color(t.foreground).child(summary?.task || "No progress summary yet."))
      .when(Boolean(summary && chat.linkSummary?.stale), row => row.child(div().text_color(t.blocked).child("Summary may be out of date. Latest activity is available in the conversation.")))
      .children([...(summary?.progress ?? []), ...(summary?.decisions ?? []).map(s => `Decision: ${s}`), ...(summary?.blockers ?? []).map(s => `Blocked: ${s}`), ...(summary?.needs ?? []).map(s => `Needs: ${s}`), ...(summary?.references ?? []).map(s => `Reference: ${s}`)].map(s => div().child(s)))
      .when(Boolean(chat.linkSummary?.reportError), row => row.child(div().text_color(t.blocked).child("Parent update is waiting to be delivered.")))));
}

/** A chat name editor, separate from the message composer. */
export function renameEditor(v, t) {
  const edit = v.renaming;
  if (!edit || edit.id !== v.chatId) return null;
  return v_flex().id("rename-editor").flex_none().px(14).py(10).gap(6).border_b_1().border_color(t.border)
    .child(h_flex().gap(8).items_center()
      .child(Input.new(edit.box).flex_1().min_w(0).text_size(14).text_color(t.foreground))
      .child(pill(t, "save-chat-name", null, "Save", true, () => v.saveRename()))
      .child(pill(t, "cancel-chat-name", null, "Cancel", false, () => v.cancelRename())))
    .when(Boolean(edit.error), el => el.child(div().text_size(12).text_color(t.blocked).child(edit.error)));
}

/** A separate editor keeps queued changes out of the next message's draft. */
export function queueEditor(v, t) {
  const edit = v.queueEdit;
  if (!edit || edit.chat !== v.chatId) return null;
  return v_flex().id("queue-editor").flex_none().mx(14).mt(10).p(12).gap(8).rounded(12).bg(t.raised).border_1().border_color(t.border)
    .child(div().text_size(12).text_color(t.muted).child("Edit queued message"))
    .child(Textarea.new(edit.box).text_size(boxTextSize()).text_color(t.foreground))
    .when(Boolean(edit.error), el => el.child(div().text_size(12).text_color(t.blocked).child(edit.error)))
    .child(h_flex().gap(8)
      .child(pill(t, "save-queued-edit", null, edit.saving ? "Saving…" : "Save", true, cx => {
        if (!edit.saving) v.changeQueued(edit.id, "edit", cx);
      }))
      .when(!edit.saving, el => el.child(pill(t, "cancel-queued-edit", null, "Cancel", false, () => v.cancelQueueEdit()))));
}

/** An empty chat: the agent's picture, where it is, and the Claude / Codex switch. @param {any} v @param {Theme} t */
function emptyChat(v, t) {
  const chat = v.chat(v.chatId);
  const pick = (/** @type {string} */ id) => h_flex().id(`pick-${id}`).h(40).pl(8).pr(16).gap(8).items_center().rounded_full()
    .cursor_pointer().text_size(14).font_medium()
    .when(chat.agent === id, (el) => el.bg(t.selected).text_color(t.foreground))
    .when(chat.agent !== id, (el) => el.text_color(t.muted).hover((s) => s.bg(t.hover)))
    .on_click((_e, cx) => {
      if (v.busy(chat) || chat.agent === id) return;
      v.setChatAgent(chat, id);
      chat.model = null; chat.selectedModel = null;
      chat.models = null; chat.modelsError = null; chat.modelsLoading = false;
      v.modelPicker = null;
      cx.notify();
    })
    .child(agentPicture(id, 26)).child(AGENTS[id].name);
  return v_flex().flex_1().items_center().justify_center().gap(14)
    .child(agentPicture(chat.agent, 72))
    .child(v_flex().items_center().gap(4)
      .child(div().text_size(18).font_semibold().text_color(t.foreground).child(v.quick ? "New quick chat" : `New chat in ${chat.project}`))
      .child(div().text_size(13.5).text_color(t.muted).child("Pick who you're talking to, then send your first message.")))
    .child(h_flex().p(4).gap(4).rounded_full().bg(t.raised).border_1().border_color(t.border)
      .child(pick("claude")).child(pick("codex")));
}

/** A message row that reports its height for the scroll keys. @param {any} v @param {string} id @param {string} key @param {any} row */
function measured(v, id, key, row) {
  return row.id(id).on_size_change((size, cx) => v.measureRow(key, size.height, cx));
}

/** The active agent's available models. @param {any} v @param {Theme} t @param {any} chat */
function modelPicker(v, t, chat) {
  const blocked = v.busy(chat) || v.needsYou(chat);
  return v_flex().flex_none().mx(14).mt(10).p(10).gap(8).rounded(12).bg(t.raised).border_1().border_color(t.border)
    .child(h_flex().gap(8).items_center()
      .child(div().flex_1().text_size(13).font_semibold().text_color(t.foreground).child("Choose model"))
      .child(roundButton(t, "close-models", `${ICONS}/close.svg`, 28, () => { v.modelPicker = null; })))
    .child(div().text_size(12).text_color(t.dim).child(chat.modelSaving ? "Switching model…" : blocked ? "Finish the current turn or question before switching." : "Applies to your next message in this conversation."))
    .when(Boolean(chat.modelsLoading), el => el.child(div().text_size(12.5).text_color(t.muted).child("Loading models…")))
    .when(Boolean(chat.modelsError), el => el.child(v_flex().gap(6)
      .child(div().text_size(12.5).text_color(t.blocked).child(chat.modelsError))
      .child(pill(t, "retry-models", null, "Try again", false, cx => v.loadModels(chat, cx)))))
    .child(v_flex().max_h(220).overflow_y_scrollbar().gap(2).children((chat.models ?? []).map(model => {
      const selected = model.id === (chat.selectedModel ?? chat.model);
      return h_flex().id(`model-${model.id}`).px(10).py(8).gap(12).items_center().rounded(8)
        .bg(selected ? t.selected : t.raised).text_color(blocked ? t.dim : t.foreground)
        .when(!blocked, row => row.cursor_pointer().hover(s => s.bg(t.hover)).on_click((_e, cx) => { v.chooseModel(model.id, cx); cx.notify(); }))
        .child(div().flex_1().min_w(0).truncate().text_size(13).child(model.name))
        .when(selected, row => row.child(div().text_size(12).text_color(t.accent).child("Selected")));
    })))
    .when(!chat.modelsLoading && !chat.modelsError && chat.models?.length === 0, el => el.child(div().text_size(12.5).text_color(t.muted).child("No models available.")));
}

/** The whole chat card. @param {any} v @param {Theme} t @param {number} width the card's width */
export function chatView(v, t, width) {
  const chat = v.chat(v.chatId);
  const agent = AGENTS[chat.agent] ?? AGENTS.claude;
  const project = v.project(chat.project);
  const ask = v.waiting(chat);
  const needs = v.needsYou(chat);
  const typingHere = v.thinking(chat) && !needs;
  const statusColor = needs ? t.blocked : typingHere ? t.working : chat.disconnected ? t.blocked : chat.connectionSlow ? t.muted : t.done;
  const status = needs ? "Waiting for you" : chat.connectionSlow ? "Reconnecting\u2026" : typingHere ? "Thinking\u2026" : chat.loading ? "Loading\u2026" : chat.disconnected ? "Disconnected" : "Ready";
  const max = Math.max(240, Math.round((width - 40) * 0.62));
  const list = v.visibleThread(chat);
  const searchMatches = v.chatSearchOpen ? v.chatMatches() : [];
  const searchCurrent = searchMatches[v.chatSearchIndex];
  const input = v.inputFor(chat.agent);
  const hasText = input.value().trim().length > 0 || (chat.attached ?? []).length > 0;
  const loading = v.starting || v.restoring?.id === chat.id;
  const palette = messageColors(t);

  const header = h_flex().flex_none().gap(12).items_center().pl(v.sidebarHidden ? 10 : 18).pr(12).py(12).border_b_1().border_color(t.border)
    // Shows the hidden sidebar (ctrl-b). While it shows, its own bottom row has the button.
    .when(v.sidebarHidden && !v.quick, (el) => el.child(roundButton(t, "show-sidebar", `${ICONS}/sidebar.svg`, 32, () => v.toggleSidebar())))
    .child(withDot(agentPicture(chat.agent, 40), 40, statusColor, t.background))
    .child(v_flex().flex_1().min_w(0).gap(2)
      .child(h_flex().min_w(0).gap(4).items_center()
        .child(div().min_w(0).truncate().text_size(16).font_semibold().text_color(t.foreground).cursor_pointer()
          .on_click((_e, cx) => { v.beginRename(chat.id); cx.notify(); }).child(chat.title))
        .child(roundButton(t, "rename-chat", `${ICONS}/pencil.svg`, 26, () => v.beginRename(chat.id))))
      .child(h_flex().min_w(0).gap(4).items_center().text_size(12.5)
        .child(div().text_color(t.muted).child(`${agent.name} ·`))
        .child(h_flex().id("chat-model").min_w(0).px(4).rounded(4).gap(4).items_center().text_color(t.muted).cursor_pointer().hover(s => s.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { v.toggleModels(cx); cx.notify(); })
          .child(div().min_w(0).truncate().child(chat.model ?? chat.selectedModel ?? "Choose model"))
          .child(div().flex_none().text_size(10).child("▾")))
        .child(div().text_color(t.muted).child("·"))
        .child(div().flex_none().text_color(statusColor).child(status))))
    .child(h_flex().flex_none().gap(6).px(10).py(5).items_center().rounded(8).bg(t.raised).border_1().border_color(t.border)
      .text_size(12).font_family(mono()).text_color(t.muted)
      .child(svg(`${ICONS}/folder.svg`).size(13)).child(v.quick ? "Quick chat · deleted when closed" : project?.path ?? chat.project))
    .child(h_flex().id("chat-outputs").flex_none().px(10).py(7).gap(5).rounded(8).items_center().cursor_pointer().text_size(12).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { v.toggleOutputs(cx); cx.notify(); })
      .child(svg(`${ICONS}/file.svg`).size(16)).child(`Files${chat.outputs?.length ? ` (${chat.outputs.length})` : ""}`))
    .child(roundButton(t, "pin-chat", `${ICONS}/pin.svg`, 32, () => v.togglePin(chat.id))
      .when(Boolean(chat.pinned), el => el.bg(t.selected).text_color(t.accent)))
    .when(Boolean(chat.parentId || chat.linkSummary?.summary || (v.chats ?? []).some(c => c.parentId === (chat.linkId ?? chat.id))), el => el.child(summaryButton(v, t, chat)))
    .child(roundButton(t, "chat-search", `${ICONS}/search.svg`, 36, () => v.toggleChatSearch()))
    // A quick chat goes with its tab, so its trash closes the tab, which deletes it.
    .child(roundButton(t, "chat-delete", `${ICONS}/trash.svg`, 36, () => v.quick ? v.closeQuick() : v.askDelete(chat.id)));

  const body = list.length === 0 && !typingHere && (chat.session || chat.loading)
    ? v_flex().flex_1().items_center().justify_center().child(div().text_size(13).text_color(t.dim).child(chat.loading ? "Loading\u2026" : "No messages to show."))
    : list.length === 0 && !typingHere
    ? emptyChat(v, t)
    : v_flex().id("messages").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(v.scroll)
      .px(20).pt(LIST_PAD_TOP).pb(LIST_PAD_BOTTOM)
      // The keys' scroll position (keys.js scrollChat) follows the wheel too. Its sign: a wheel
      // turned toward you scrolls down, and GPUI reports that as a negative y.
      .on_size_change((size, cx) => v.measureViewport(size.height, cx))
      .on_scroll_wheel((e) => {
        const dy = e.delta_lines ? e.delta_lines.y * 20 : e.delta.y;
        v.trackMessageScroll(dy);
      })
      .children(list.map((m, i) => measured(v, `row-${m.id}`, m.id, messageRow(v, t, list, i, max, i === searchCurrent, palette))))
      .when(typingHere, (el) => el.child(measured(v, "row-typing", "typing", typingRow(v, t))))
      .child(div().id("chat-end").flex_none().h(1));

  // While a permission card waits, the message box gives way to its question and answers.
  const askBar = ask && h_flex().flex_none().gap(10).items_center().mx(14).mt(10).mb(14).pl(16).pr(8).py(8).rounded(16)
    .bg(t.raised).border_1().border_color(t.blocked)
    .child(div().flex_1().min_w(0).truncate().text_size(13.5).text_color(t.foreground).child(wantsTo(agent.name, ask.title)))
    .children(askButtons(v, t, (answer) => `bar-${answer}`));

  const working = v.thinking(chat);
  // The box grows with new lines (shift-enter), so the buttons sit at its bottom.
  const composer = askBar || h_flex().flex_none().gap(8).items_end().px(14).pt(10).pb(14)
    .child(h_flex().flex_1().min_h(42).px(16).py(10).items_center().rounded(21).bg(t.raised).border_1().border_color(t.border)
      .child(Textarea.new(input).flex_1().text_size(boxTextSize()).text_color(t.foreground))
      .child(boxHints(t, [[`${v.keyHint("scrollDown")} ${v.keyHint("scrollUp")}`.trim(), "scroll"],
        ...(working && chat.real ? [[v.keyHint("stop"), "stop"]] : [])])))
    // A new message can be queued while Stop remains available for the active turn.
    .when(working && chat.real && !v.question(chat), el => el.child(h_flex().id("stop").flex_none().size(36).rounded_full().items_center().justify_center().cursor_pointer()
        .bg(t.raised).border_1().border_color(t.border).text_color(t.foreground).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { v.stop(); cx.notify(); })
        .child(svg(`${ICONS}/stop.svg`).size(16))))
    .when(!working || hasText, el => el.child(h_flex().id("send").flex_none().size(36).rounded_full().items_center().justify_center()
        .bg(hasText ? t.accent : t.hover).text_color(hasText ? t.accent_foreground : t.dim)
        .when(hasText, (el) => el.cursor_pointer())
        .on_click((_e, cx) => { v.send(cx); cx.notify(); })
        .child(svg(`${ICONS}/send.svg`).size(18))));

  const plan = v.showPlan !== false && typingHere && chat.plan?.length ? planBox(t, chat.plan) : null;
  const pasted = !askBar && ((chat.attached ?? []).length > 0 || chat.pasteError);
  const toast = outputToast(v, t, chat);
  const slash = askBar ? null : v.slashItems();
  return v_flex().id("chat").relative().flex_1().min_w(0).h_full().rounded(14).border_1().border_color(v.zone === "chat" ? focusBorder(t) : t.border).bg(t.background).overflow_hidden()
    // Images dropped anywhere on the chat go with the next message, as pasted ones do.
    .on_drop((e, cx) => { v.dropImages(e.paths ?? [], cx); cx.notify(); })
    // Keep the real chat painted beneath the cover so native text and scrolling settle before reveal.
    .child(v_flex().flex_1().min_h(0).w_full()
      .child(header)
      .when(Boolean(chat.parentId || v.summaryFor === chat.id), el => el.child(linkedChatsView(v, t, chat)))
      .when(Boolean(v.renaming), el => el.child(renameEditor(v, t)))
      .when(v.chatSearchOpen, el => {
        const matches = searchMatches;
        return el.child(h_flex().flex_none().px(14).py(8).gap(8).items_center().border_b_1().border_color(t.border)
          .child(Input.new(v.chatSearchInput).flex_1().text_size(13).text_color(t.foreground))
          .child(div().text_size(12).text_color(t.muted).child(matches.length ? `${Math.min(v.chatSearchIndex + 1, matches.length)} of ${matches.length}` : v.chatSearchInput.value().trim() ? "No matches" : "Find in conversation"))
          .child(pill(t, "find-previous", null, "Previous", false, () => v.findChatMatch(-1)))
          .child(pill(t, "find-next", null, "Next", false, () => v.findChatMatch(1)))
          .child(roundButton(t, "close-chat-search", `${ICONS}/close.svg`, 28, () => v.toggleChatSearch())));
      })
      .when(v.modelPicker === chat.id, el => el.child(modelPicker(v, t, chat))).child(body).when(Boolean(plan), (el) => el.child(plan)).when(Boolean(pasted), (el) => el.child(attachments(v, t, chat)))
      .when(Boolean(slash), (el) => el.child(slashMenu(v, t, slash ?? []))).when(Boolean(v.queueEdit), el => el.child(queueEditor(v, t))).child(composer))
    .when(Boolean(toast), (el) => el.child(toast))
    .when(Boolean(loading), el => el.child(v_flex().id("chat-loading").absolute().top(1).bottom(1).left(1).right(1).rounded(13).overflow_hidden().bg(t.popover)
      .items_center().justify_center().child(div().text_size(13).text_color(t.dim).child("Loading conversation…"))));
}
