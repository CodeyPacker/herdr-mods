// Bridge events to chat messages, and the words for tool calls and permission cards.

/**
 * A message in a chat's thread:
 *   { kind: "sep", text }                                     a day divider
 *   { kind: "text", from: "me" | "agent", text, time? }       a bubble
 *   { kind: "image", from: "me" | "agent", path, w, h, time? } a picture (path for image(), from Herdr's home)
 *   { kind: "tool", from: "agent", icon, title, lines, add?, del? }  a tool call card
 *   { kind: "permission", from: "agent", ask, tool, state, title, lines, covers }  a permission card
 *       (covers: what "Always allow" would allow, in words)
 *   { kind: "question", from: "agent", ask, questions, picks, state }  the agent's questions for you:
 *       questions are { id, header, question, options: { label, description }[], multi }, picks
 *       the answers so far by question id, state "pending", "answered" or "dismissed"
 *   { kind: "error", from: "agent", text } and { kind: "note", text }
 * @typedef {{ id: string, kind: string, from?: string, text?: string, time?: string, lang?: string, icon?: string, title?: string, lines?: string[], add?: string, del?: string, [k: string]: any }} Message
 */

/** How many lines of a tool's output its card shows when opened. */
const OUTPUT_LINES = 12;
/** How many lines of an edit a permission card shows. */
const DIFF_LINES = 14;

/** A path's last part. @param {any} p */
function base(p) {
  return String(p ?? "").split(/[\\/]/).filter(Boolean).pop() ?? String(p ?? "");
}

/** @param {any} s */
function lineCount(s) {
  return s ? String(s).split("\n").length : 0;
}

/** @param {string} s @param {number} n */
function clip(s, n) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

/** The first `n` lines, then "…" when there were more. @param {string[]} lines @param {number} n */
function capped(lines, n) {
  return lines.length > n ? [...lines.slice(0, n), "…"] : lines;
}

/** The plan tool Hey, chat gives Claude (bridge.mjs), as Claude names it. */
export const PLAN_TOOL = "mcp__heychat__plan";
const PLAN_STATES = new Set(["pending", "in_progress", "completed"]);

/**
 * A plan tool call's steps: { text, status } each, status "pending", "in_progress" or "completed".
 * @param {any} input @returns {{ text: string, status: string }[]}
 */
export function planSteps(input) {
  const items = Array.isArray(input?.items) ? input.items : [];
  return items
    .map((/** @type {any} */ s) => ({ text: String(s?.text ?? "").trim(), status: PLAN_STATES.has(s?.status) ? s.status : "pending" }))
    .filter((s) => s.text);
}

/**
 * A tool call as a card: icon, title, +/− counts and the lines it shows when opened.
 * @param {string} name @param {any} input
 * @returns {{ icon: string, title: string, lines: string[], add?: string, del?: string }}
 */
export function describeTool(name, input) {
  const i = input ?? {};
  switch (name) {
    case "Read": return { icon: "file", title: `Read ${base(i.file_path)}`, lines: [String(i.file_path ?? "")] };
    case "Grep": return { icon: "file", title: `Searched for ${clip(String(i.pattern ?? ""), 40)}`, lines: [String(i.path ?? i.glob ?? ".")] };
    case "Glob": return { icon: "file", title: `Looked for ${clip(String(i.pattern ?? ""), 40)}`, lines: [String(i.path ?? ".")] };
    case "LS": return { icon: "file", title: `Listed ${base(i.path)}`, lines: [String(i.path ?? "")] };
    case "Edit": return { icon: "edit", title: `Edited ${base(i.file_path)}`, add: `+${lineCount(i.new_string)}`, del: `−${lineCount(i.old_string)}`, lines: [String(i.file_path ?? "")] };
    case "MultiEdit": {
      const edits = Array.isArray(i.edits) ? i.edits : [];
      const add = edits.reduce((n, e) => n + lineCount(e.new_string), 0), del = edits.reduce((n, e) => n + lineCount(e.old_string), 0);
      return { icon: "edit", title: `Edited ${base(i.file_path)}`, add: `+${add}`, del: `−${del}`, lines: [String(i.file_path ?? "")] };
    }
    case "Write": return { icon: "edit", title: `Wrote ${base(i.file_path)}`, add: `+${lineCount(i.content)}`, del: "−0", lines: [String(i.file_path ?? "")] };
    case "NotebookEdit": return { icon: "edit", title: `Edited ${base(i.notebook_path)}`, lines: [String(i.notebook_path ?? "")] };
    case "Bash": return { icon: "run", title: `Ran ${clip(String(i.command ?? ""), 48)}`, lines: [String(i.command ?? "")] };
    case "WebFetch": return { icon: "file", title: `Read ${clip(String(i.url ?? ""), 48)}`, lines: [String(i.url ?? "")] };
    case "WebSearch": return { icon: "file", title: `Searched the web for ${clip(String(i.query ?? ""), 36)}`, lines: [String(i.query ?? "")] };
    case "TodoWrite": {
      const todos = Array.isArray(i.todos) ? i.todos : [];
      return { icon: "run", title: "Updated the plan", lines: todos.map((/** @type {any} */ t) => `${t.status === "completed" ? "✓" : "·"} ${t.content ?? ""}`) };
    }
    case PLAN_TOOL:
      return { icon: "run", title: "Updated the plan", lines: planSteps(i).map((s) => `${s.status === "completed" ? "✓" : "·"} ${s.text}`) };
    // Codex's file changes: one card for a patch, which can touch several files.
    case "CodexPatch": {
      const changes = Array.isArray(i.changes) ? i.changes : [];
      const diffLines = changes.flatMap((/** @type {any} */ c) => String(c.diff ?? "").split("\n"));
      const add = diffLines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
      const del = diffLines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
      const title = changes.length === 1 ? `Edited ${base(changes[0].path)}` : `Edited ${changes.length} files`;
      return { icon: "edit", title, add: `+${add}`, del: `\u2212${del}`, lines: changes.map((/** @type {any} */ c) => String(c.path ?? "")) };
    }
    case "AskUserQuestion": {
      const qs = Array.isArray(i.questions) ? i.questions : [];
      return { icon: "run", title: qs.length === 1 ? "Asked you a question" : `Asked you ${qs.length} questions`, lines: qs.map((/** @type {any} */ q) => String(q.question ?? "")) };
    }
    case "Task": case "Agent": return { icon: "run", title: `Started a helper: ${clip(String(i.description ?? ""), 36)}`, lines: [clip(String(i.prompt ?? ""), 200)] };
    default: return { icon: "run", title: `Used ${name}`, lines: [clip(JSON.stringify(i), 200)] };
  }
}

/** The first word of a finished tool card's title, and what it says while the tool still runs. */
const RUNNING = [["Ran", "Running"], ["Read", "Reading"], ["Edited", "Editing"], ["Wrote", "Writing"], ["Searched", "Searching"],
  ["Looked", "Looking"], ["Listed", "Listing"], ["Updated", "Updating"], ["Started", "Starting"], ["Used", "Using"], ["Asked", "Asking"]];

/** A finished card's title as it reads while the tool runs: "Ran ls" → "Running ls". @param {string} title */
export function runningTitle(title) {
  for (const [done, now] of RUNNING) if (title.startsWith(`${done} `)) return `${now}${title.slice(done.length)}`;
  return title;
}

/** Useful work to show beside the dots, only while its tool runs. @param {string} name @param {any} input */
export function describeActivity(name, input) {
  const i = input ?? {};
  if (name === "Bash") {
    const command = String(i.command ?? "");
    if (/\b(?:rg|grep|graphify)\b/.test(command)) return "Searching the repo";
    if (/\b(?:sed|cat|head|tail)\b/.test(command)) return "Reading files";
    if (/\b(?:test|pytest|vitest|playwright)\b/.test(command)) return "Running tests";
    if (/\b(?:build|check|tsc)\b/.test(command)) return "Checking changes";
    if (/\bgit\s+(?:diff|status|log|show)\b/.test(command)) return "Reviewing changes";
    return "";
  }
  if (["Read", "Grep", "Glob", "LS", "Edit", "MultiEdit", "Write", "NotebookEdit", "CodexPatch", "WebSearch", "WebFetch", "Task", "Agent"].includes(name)) {
    return runningTitle(describeTool(name, input).title);
  }
  // Computer tools supply a human-readable action, unlike their internal tool names.
  if (/cua_repl/.test(name) && typeof i.title === "string") return clip(i.title, 72);
  return "";
}

/** The latest useful tool still running. Completed activity never lingers. @param {any} chat */
export function currentActivity(chat) {
  if (!chat.working) return "";
  const cards = [...(chat.tools?.values() ?? [])];
  for (let n = cards.length - 1; n >= 0; n--) if (cards[n].running && cards[n].activity) return cards[n].activity;
  return "";
}

/**
 * What a permission card asks, and what it shows under the question.
 * @param {string} name @param {any} input @returns {{ title: string, lines: string[] }}
 */
export function describeAsk(name, input) {
  const i = input ?? {};
  if (name === "Bash") return { title: `Run ${clip(String(i.command ?? ""), 60)}`, lines: [String(i.command ?? ""), ...(i.description ? [String(i.description)] : [])] };
  if (name === "Edit" || name === "MultiEdit") {
    const edits = name === "Edit" ? [i] : (Array.isArray(i.edits) ? i.edits : []);
    const diff = edits.flatMap((/** @type {any} */ e) => [
      ...String(e.old_string ?? "").split("\n").map((l) => `- ${l}`),
      ...String(e.new_string ?? "").split("\n").map((l) => `+ ${l}`),
    ]);
    return { title: `Edit ${base(i.file_path)}`, lines: [String(i.file_path ?? ""), ...capped(diff, DIFF_LINES)] };
  }
  if (name === "Write") {
    const body = String(i.content ?? "").split("\n").map((l) => `+ ${l}`);
    return { title: `Write ${base(i.file_path)}`, lines: [String(i.file_path ?? ""), ...capped(body, DIFF_LINES)] };
  }
  if (name === "CodexPatch") {
    const changes = Array.isArray(i.changes) ? i.changes : [];
    const diff = changes.flatMap((/** @type {any} */ c) => [String(c.path ?? ""), ...String(c.diff ?? "").split("\n")
      .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"))
      .map((l) => `${l[0]} ${l.slice(1)}`)]);
    const title = changes.length === 1 ? `Edit ${base(changes[0].path)}` : `Edit ${changes.length} files`;
    return { title, lines: capped(diff, DIFF_LINES) };
  }
  const d = describeTool(name, input);
  return { title: `Use ${name}`, lines: d.lines };
}

/** "9:46 AM" for a time in ms. @param {number} at */
export function clock(at) {
  // Built by hand: Herdr's JavaScript ignores toLocaleTimeString's options and shows seconds.
  const d = new Date(at);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A chat's time in the tree: "9:46 AM" today, "Yesterday", "Mon" this week, else "Nov 12". @param {number} at */
export function shortWhen(at) {
  const now = Date.now();
  if (sameDay(at, now)) return clock(at);
  if (sameDay(at, now - 86400000)) return "Yesterday";
  const d = new Date(at);
  if (now - at < 6 * 86400000) return DAYS[d.getDay()];
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** True when two times fall on the same day. @param {number} a @param {number} b */
function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** "Today 9:46 AM", "Yesterday 4:12 PM" or "Nov 12, 4:12 PM". @param {number} at */
function dayLabel(at) {
  const now = Date.now();
  if (sameDay(at, now)) return `Today ${clock(at)}`;
  if (sameDay(at, now - 86400000)) return `Yesterday ${clock(at)}`;
  const d = new Date(at);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${clock(at)}`;
}

/** The displayed history, keeping hidden activity available when condensed mode is off. @param {any} chat @param {boolean} condensed */
export function visibleMessages(chat, condensed) {
  if (!condensed) return chat.thread;
  return chat.thread.filter((m) => {
    if (m.kind === "tool") return false;
    if (m.kind === "permission") return m.state === "pending";
    if (m.kind === "text" && m.from === "agent" && /^\s*::browser-complete\{[^\n]*\}\s*$/.test(m.text ?? "")) return false;
    return true;
  });
}

/** Clears what a chat built from its bridge before replaying its events. @param {any} chat */
export function resetThread(chat) {
  chat.thread = [];
  chat.tools = new Map();     // tool call id → its card
  chat.asks = new Map();      // permission id → its card
  chat.questions = new Map(); // question id → its card
  chat.working = false;
  chat.lastAt = 0;
  chat.plan = null;           // the agent's latest plan: { text, status }[]
}

/**
 * Applies one bridge event to a chat: adds or updates its messages and its working state.
 * Returns what the view should know: "asked" when a permission card arrived, "ended" when a turn ended.
 * @param {any} chat @param {any} ev @returns {"asked" | "question" | "ended" | null}
 */
export function applyEvent(chat, ev) {
  const push = (/** @type {any} */ m) => { chat.thread.push({ id: `${chat.id}.${chat.thread.length}`, ...m }); return chat.thread[chat.thread.length - 1]; };
  switch (ev.type) {
    case "connection":
      chat.reconnecting = ev.state === "reconnecting";
      chat.disconnected = ev.state === "disconnected";
      return null;
    case "model":
      if (typeof ev.model === "string" && ev.model) chat.model = ev.model;
      return null;
    case "ready":
    case "session":
      if (ev.session ?? ev.id) chat.session = ev.session ?? ev.id;
      return null;
    case "queue_error": {
      for (const card of chat.thread) if (card.queueId === ev.id) { card.sending = false; card.queueError = String(ev.message ?? "Couldn't send. Try again."); }
      return null;
    }
    case "queued":
    case "user": {
      // A message the agent now reads starts a new turn, and the last turn's plan goes with it.
      if (ev.type === "user") chat.plan = null;
      const queueId = ev.queueId ?? (ev.type === "queued" ? ev.id : null);
      const existing = queueId && chat.thread.filter(m => m.queueId === queueId);
      if (existing?.length) {
        for (const card of existing) { card.queued = ev.type === "queued"; card.sending = false; card.queueError = null; }
        return null;
      }
      const at = Number(ev.at) || Date.now();
      if (!chat.lastAt || !sameDay(chat.lastAt, at) || at - chat.lastAt > 3600000) push({ kind: "sep", text: dayLabel(at) });
      chat.lastAt = at;
      chat.time = clock(at);
      const state = { queueId, queued: ev.type === "queued" };
      for (const img of Array.isArray(ev.images) ? ev.images : []) push({ kind: "image", from: "me", path: img.path, w: img.w, h: img.h, time: clock(at), ...state });
      if (ev.text) push({ kind: "text", from: "me", text: ev.text, time: clock(at), ...state });
      if (state.queued) chat.thread[chat.thread.length - 1].queueAction = true;
      return null;
    }
    case "image":
      push({ kind: "image", from: "agent", path: ev.path, w: ev.w, h: ev.h });
      return null;
    case "note":
      push({ kind: "note", text: String(ev.text ?? "") });
      return null;
    case "working":
      chat.working = true;
      return null;
    case "text":
      push({ kind: "text", from: "agent", text: ev.text });
      return null;
    case "tool": {
      // The card says "Running …" until the tool is done, then "Ran …".
      // Each plan call replaces the whole list.
      if (ev.name === PLAN_TOOL) chat.plan = planSteps(ev.input);
      const d = describeTool(ev.name, ev.input);
      const card = push({ kind: "tool", from: "agent", ...d, activity: describeActivity(ev.name, ev.input), doneTitle: d.title, title: runningTitle(d.title), running: true });
      chat.tools.set(ev.id, card);
      return null;
    }
    case "tool_done": {
      const card = chat.tools.get(ev.id);
      if (!card) return null;
      card.running = false;
      card.title = ev.error ? `${card.doneTitle} (failed)` : card.doneTitle;
      card.failed = Boolean(ev.error);
      const out = String(ev.output ?? "").split("\n").filter((l) => l.trim());
      if (card.icon === "run" && out.length) card.lines = [...card.lines, ...capped(out, OUTPUT_LINES)];
      if (ev.error && card.icon !== "run" && out.length) card.lines = [...card.lines, out[0]];
      return null;
    }
    case "permission": {
      const card = push({ kind: "permission", from: "agent", ask: ev.id, tool: ev.tool, state: "pending", covers: typeof ev.covers === "string" ? ev.covers : null, ...describeAsk(ev.tool, ev.input) });
      chat.asks.set(ev.id, card);
      return "asked";
    }
    case "question": {
      const card = push({ kind: "question", from: "agent", ask: ev.id, questions: Array.isArray(ev.questions) ? ev.questions : [], async: Boolean(ev.async), picks: {}, state: "pending" });
      chat.questions.set(ev.id, card);
      return "question";
    }
    case "answered": {
      const card = chat.questions.get(ev.id);
      if (card) { card.state = "answered"; card.picks = ev.answers ?? card.picks; }
      return null;
    }
    case "decided": {
      const q = chat.questions.get(ev.id);
      if (q) { if (q.state === "pending") q.state = "dismissed"; return null; }
      const card = chat.asks.get(ev.id);
      if (card) card.state = ev.behavior === "allow" ? (ev.always ? "always" : "allowed") : "denied";
      return null;
    }
    case "turn_end":
      chat.working = false;
      for (const card of chat.asks.values()) if (card.state === "pending") card.state = "denied";
      for (const card of chat.questions.values()) if (card.state === "pending" && (!card.async || ev.error || ev.stopped)) card.state = "dismissed";
      // A tool the turn ended in the middle of.
      for (const card of chat.tools.values()) if (card.running) { card.running = false; card.failed = true; card.title = `${card.doneTitle} (${ev.stopped ? "stopped" : "didn't finish"})`; }
      if (ev.stopped) push({ kind: "note", text: "Stopped." });
      else if (ev.error) push({ kind: "error", from: "agent", text: String(ev.text || "Something went wrong.") });
      return "ended";
    case "error":
      chat.working = false;
      push({ kind: "error", from: "agent", text: String(ev.message ?? "Something went wrong.") });
      return "ended";
    default:
      return null;
  }
}

/** The first card still pending in a map of cards, or null. @param {Map<string, any> | undefined} cards */
function firstPending(cards) {
  for (const card of cards?.values() ?? []) if (card.state === "pending") return card;
  return null;
}

/** The question card waiting on you in a chat, or null. @param {any} chat */
export function pendingQuestion(chat) {
  return firstPending(chat.questions);
}

/** The permission card waiting on you in a chat, or null. @param {any} chat */
export function pendingAsk(chat) {
  return firstPending(chat.asks);
}
