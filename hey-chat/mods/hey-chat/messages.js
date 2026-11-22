// Bridge events to chat messages (scope section 3), and the words for tool calls and permission cards.

/**
 * A message in a chat's thread:
 *   { kind: "sep", text }                                     a day divider
 *   { kind: "text", from: "me" | "agent", text, time? }       a bubble
 *   { kind: "code", from: "agent", lang, text }               a code card
 *   { kind: "tool", from: "agent", icon, title, lines, add?, del? }  a tool call card
 *   { kind: "permission", from: "agent", ask, tool, state, title, lines }  a permission card
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
    // Codex's file changes: one card for a patch, which can touch several files.
    case "CodexPatch": {
      const changes = Array.isArray(i.changes) ? i.changes : [];
      const diffLines = changes.flatMap((/** @type {any} */ c) => String(c.diff ?? "").split("\n"));
      const add = diffLines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
      const del = diffLines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
      const title = changes.length === 1 ? `Edited ${base(changes[0].path)}` : `Edited ${changes.length} files`;
      return { icon: "edit", title, add: `+${add}`, del: `\u2212${del}`, lines: changes.map((/** @type {any} */ c) => String(c.path ?? "")) };
    }
    case "Task": case "Agent": return { icon: "run", title: `Started a helper: ${clip(String(i.description ?? ""), 36)}`, lines: [clip(String(i.prompt ?? ""), 200)] };
    default: return { icon: "run", title: `Used ${name}`, lines: [clip(JSON.stringify(i), 200)] };
  }
}

/** The first word of a finished tool card's title, and what it says while the tool still runs. */
const RUNNING = [["Ran", "Running"], ["Read", "Reading"], ["Edited", "Editing"], ["Wrote", "Writing"], ["Searched", "Searching"],
  ["Looked", "Looking"], ["Listed", "Listing"], ["Updated", "Updating"], ["Started", "Starting"], ["Used", "Using"]];

/** A finished card's title as it reads while the tool runs: "Ran ls" → "Running ls". @param {string} title */
export function runningTitle(title) {
  for (const [done, now] of RUNNING) if (title.startsWith(`${done} `)) return `${now}${title.slice(done.length)}`;
  return title;
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
    return { title: `Edit ${base(i.file_path)}`, lines: [String(i.file_path ?? ""), ...diff.slice(0, DIFF_LINES), ...(diff.length > DIFF_LINES ? ["…"] : [])] };
  }
  if (name === "Write") {
    const body = String(i.content ?? "").split("\n");
    return { title: `Write ${base(i.file_path)}`, lines: [String(i.file_path ?? ""), ...body.slice(0, DIFF_LINES).map((l) => `+ ${l}`), ...(body.length > DIFF_LINES ? ["…"] : [])] };
  }
  if (name === "CodexPatch") {
    const changes = Array.isArray(i.changes) ? i.changes : [];
    const diff = changes.flatMap((/** @type {any} */ c) => [String(c.path ?? ""), ...String(c.diff ?? "").split("\n")
      .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"))
      .map((l) => `${l[0]} ${l.slice(1)}`)]);
    const title = changes.length === 1 ? `Edit ${base(changes[0].path)}` : `Edit ${changes.length} files`;
    return { title, lines: [...diff.slice(0, DIFF_LINES), ...(diff.length > DIFF_LINES ? ["\u2026"] : [])] };
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

/**
 * Clears what a chat built from its bridge, before the bridge replays its events.
 * @param {any} chat
 */
export function resetThread(chat) {
  chat.thread = [];
  chat.tools = new Map();     // tool call id → its card
  chat.asks = new Map();      // permission id → its card
  chat.working = false;
  chat.lastAt = 0;
}

/**
 * Applies one bridge event to a chat: adds or updates its messages and its working state.
 * Returns what the view should know: "asked" when a permission card arrived, "ended" when a turn ended.
 * @param {any} chat @param {any} ev @returns {"asked" | "ended" | null}
 */
export function applyEvent(chat, ev) {
  const push = (/** @type {any} */ m) => { chat.thread.push({ id: `${chat.id}.${chat.thread.length}`, ...m }); return chat.thread[chat.thread.length - 1]; };
  switch (ev.type) {
    case "ready":
    case "session":
      if (ev.session ?? ev.id) chat.session = ev.session ?? ev.id;
      return null;
    case "user": {
      const at = Number(ev.at) || Date.now();
      if (!chat.lastAt || !sameDay(chat.lastAt, at) || at - chat.lastAt > 3600000) push({ kind: "sep", text: dayLabel(at) });
      chat.lastAt = at;
      chat.time = clock(at);
      push({ kind: "text", from: "me", text: ev.text, time: clock(at) });
      return null;
    }
    case "working":
      chat.working = true;
      return null;
    case "text":
      push({ kind: "text", from: "agent", text: ev.text });
      return null;
    case "tool": {
      // The card says "Running …" until the tool is done, then "Ran …".
      const d = describeTool(ev.name, ev.input);
      const card = push({ kind: "tool", from: "agent", ...d, doneTitle: d.title, title: runningTitle(d.title), running: true });
      chat.tools.set(ev.id, card);
      return null;
    }
    case "tool_done": {
      const card = chat.tools.get(ev.id);
      if (!card) return null;
      card.running = false;
      card.title = ev.error ? `${card.doneTitle} (failed)` : card.doneTitle;
      const out = String(ev.output ?? "").split("\n").filter((l) => l.trim());
      if (card.icon === "run" && out.length) card.lines = [...card.lines, ...out.slice(0, OUTPUT_LINES), ...(out.length > OUTPUT_LINES ? ["…"] : [])];
      if (ev.error && card.icon !== "run" && out.length) card.lines = [...card.lines, out[0]];
      return null;
    }
    case "permission": {
      const card = push({ kind: "permission", from: "agent", ask: ev.id, tool: ev.tool, state: "pending", ...describeAsk(ev.tool, ev.input) });
      chat.asks.set(ev.id, card);
      return "asked";
    }
    case "decided": {
      const card = chat.asks.get(ev.id);
      if (card) card.state = ev.behavior === "allow" ? (ev.always ? "always" : "allowed") : "denied";
      return null;
    }
    case "turn_end":
      chat.working = false;
      for (const card of chat.asks.values()) if (card.state === "pending") card.state = "denied";
      // A tool the turn ended in the middle of.
      for (const card of chat.tools.values()) if (card.running) { card.running = false; card.title = `${card.doneTitle} (${ev.stopped ? "stopped" : "didn't finish"})`; }
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

/** The permission card waiting on you in a chat, or null. @param {any} chat */
export function pendingAsk(chat) {
  if (!chat.asks) return null;
  for (const card of chat.asks.values()) if (card.state === "pending") return card;
  return null;
}
