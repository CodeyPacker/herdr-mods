// Coloured, read-only code blocks for course pages.
// Herdr's Markdown view shows code in one colour, but its code editor colours some languages.
// Tested names (2026-11-26): "cs" and "sql" colour, "javascript" colours TypeScript too
// (types stay plain), "csharp", "typescript", "ts" and "tsx" do not.
import { div } from "gpui-kit";
import { v_flex, TextView, EditorState, Editor } from "gpui-base";

/** @typedef {import("../kit/theme.js").Theme} Theme */

/** @type {Record<string, string>} fence name → the editor's language name */
const LANGUAGES = { csharp: "cs", cs: "cs", "c#": "cs", sql: "sql", typescript: "javascript", ts: "javascript", javascript: "javascript", js: "javascript" };
const FONT = 13, LINE = 22, PAD = 10;

/** Editors per language, made once in init: Herdr refuses to make editor state while drawing. */
const PER_LANGUAGE = 16;
/** @type {Record<string, any[]>} free editors by language */
const free = {};
/** @type {Map<string, { state: any, language: string, code: string, used: number }>} block id → its editor */
const taken = new Map();
let frame = 0;

/** Make the editors. Call from a view's init or constructor, never from render. */
export function initCode() {
  if (Object.keys(free).length) return;
  for (const language of new Set(Object.values(LANGUAGES)))
    free[language] = Array.from({ length: PER_LANGUAGE }, () => EditorState.new({ language, value: "", readonly: true, line_numbers: false, folding: false, font_size: FONT }));
}

/** Whether a fence name gets colours. @param {string} fence */
export const coloured = fence => Boolean(LANGUAGES[fence.toLowerCase()]);

/** @param {string} id @param {string} text @param {string} fence */
const plain = (id, text, fence) => {
  const ticks = "`".repeat([...text.matchAll(/`+/g)].reduce((n, m) => Math.max(n, m[0].length + 1), 3));
  return TextView.markdown(id, `${ticks}${fence}\n${text}\n${ticks}`).selectable();
};

/**
 * One code block. Coloured when the language is known and an editor is free, otherwise a plain Markdown block.
 * @param {Theme} t @param {string} id stable per block @param {string} code @param {string} fence
 */
export function codeBlock(t, id, code, fence) {
  const text = code.replace(/\n+$/, "");
  const language = LANGUAGES[fence.toLowerCase()];
  let entry = taken.get(id);
  if (entry && entry.language !== language) { free[entry.language].push(entry.state); taken.delete(id); entry = undefined; }
  if (!entry && language && free[language]?.length) {
    entry = { state: free[language].pop(), language, code: "\u0000", used: frame };
    taken.set(id, entry);
  }
  if (!entry) return plain(id, text, fence);
  if (entry.code !== text) { entry.state.set_value(text); entry.code = text; }
  entry.used = frame;
  const lines = text.split("\n").length;
  return div().id(`${id}-code`).w_full().rounded(8).bg(t.raised).border_1().border_color(t.border).px(PAD).py(PAD)
    .child(div().w_full().h(Math.ceil(lines * LINE) + 4).child(Editor.new(entry.state)));
}

/**
 * Markdown text whose fenced code blocks are coloured: the prose stays Markdown, each fence becomes a code block.
 * @param {Theme} t @param {string} id @param {string} text @param {string} [fallback] the fence name for a fence with none
 */
export function richText(t, id, text, fallback = "text") {
  const parts = [], fence = /^(`{3,})([^\n`]*)\n([\s\S]*?)\n\1[ \t]*$/gm;
  let last = 0, index = 0, match;
  while ((match = fence.exec(text))) {
    const before = text.slice(last, match.index).trim();
    if (before) parts.push(TextView.markdown(`${id}-p${index}`, before).selectable());
    const name = match[2].trim().split(/\s+/)[0] || fallback;
    parts.push(codeBlock(t, `${id}-c${index}`, match[3], name));
    last = fence.lastIndex; index++;
  }
  const rest = text.slice(last).trim();
  if (rest || !parts.length) parts.push(TextView.markdown(`${id}-p${index}`, rest).selectable());
  return parts.length === 1 ? parts[0] : v_flex().gap(8).children(parts);
}

/** Call once per render, after the page is built: returns the editors that page no longer shows. */
export function sweepCode() {
  for (const [id, entry] of taken) if (entry.used !== frame) { free[entry.language].push(entry.state); taken.delete(id); }
  frame++;
}
