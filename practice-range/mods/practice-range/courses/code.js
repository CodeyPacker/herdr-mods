// Coloured, read-only code blocks for course pages.
// Herdr's Markdown view shows code in one colour, but its code editor colours some languages.
// Tested names (2026-11-26): "cs" and "sql" colour, "javascript" colours TypeScript too
// (types stay plain), "csharp", "typescript", "ts" and "tsx" do not.
import { div } from "gpui-kit";
import { v_flex, TextView, EditorState, Editor } from "gpui-base";
import { fonts, shared } from "herdr";
import { READING_KEY, readingPreferences } from "./reading-preferences.js";
import { colors } from "../kit/theme.js";

/** @typedef {import("../kit/theme.js").Theme} Theme */

/** @type {Record<string, string>} fence name → the editor's language name */
const LANGUAGES = { csharp: "cs", cs: "cs", "c#": "cs", sql: "sql", typescript: "javascript", ts: "javascript", javascript: "javascript", js: "javascript" };
const FONT = 13, LINE = 22, PAD = 10;

/** Editors per language, made once in init: Herdr refuses to make editor state while drawing. */
const PER_LANGUAGE = 16;
/**
 * Each panel has its own editors. The tab and the dialog are separate views, and Herdr releases
 * a view's editors when that view closes, so sharing them breaks the view still open.
 * @typedef {{ free: Record<string, any[]>, taken: Map<string, { state: any, language: string, code: string, used: number }>, frame: number }} Pool
 */
/** @type {Pool} the pool of the panel being drawn */
let pool = { free: {}, taken: new Map(), frame: 0 };
/** @type {Set<string> | null} */
let installedFonts = null;

/** Course prose uses reading preferences, while examples keep their code font. @param {string} id @param {string} text @param {ReturnType<typeof readingPreferences>} [preview] @param {import("gpui-kit").Color} [color] */
export function readingText(id, text, preview, color) {
  const prefs = preview ?? readingPreferences(shared(READING_KEY));
  installedFonts ??= new Set(fonts());
  return TextView.markdown(id, text).selectable().text_size(prefs.size).line_height(prefs.lineHeight).text_color(color ?? colors().foreground)
    .when(Boolean(prefs.font) && installedFonts.has(prefs.font), el => el.font_family(prefs.font));
}

/** Make this panel's editors. Call from a view's init or constructor, never from render. @param {{ codePool?: Pool }} panel */
export function initCode(panel) {
  /** @type {Record<string, any[]>} */
  const free = {};
  for (const language of new Set(Object.values(LANGUAGES)))
    free[language] = Array.from({ length: PER_LANGUAGE }, () => EditorState.new({ language, value: "", readonly: true, line_numbers: false, folding: false, font_size: FONT }));
  panel.codePool = { free, taken: new Map(), frame: 0 };
}

/** Draw with this panel's editors. Call at the start of its render. @param {{ codePool: Pool }} panel */
export function useCode(panel) { pool = panel.codePool; }

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
  const { free, taken, frame } = pool;
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
  return div().id(`${id}-code`).w_full().rounded(8).bg(t.raised).text_color(t.foreground).border_1().border_color(t.border).px(PAD).py(PAD)
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
    if (before) parts.push(readingText(`${id}-p${index}`, before, undefined, t.foreground));
    const name = match[2].trim().split(/\s+/)[0] || fallback;
    parts.push(codeBlock(t, `${id}-c${index}`, match[3], name));
    last = fence.lastIndex; index++;
  }
  const rest = text.slice(last).trim();
  if (rest || !parts.length) parts.push(readingText(`${id}-p${index}`, rest, undefined, t.foreground));
  return parts.length === 1 ? parts[0] : v_flex().gap(8).children(parts);
}

/** Call once per render, after the page is built: returns the editors that page no longer shows. */
export function sweepCode() {
  const { free, taken, frame } = pool;
  for (const [id, entry] of taken) if (entry.used !== frame) { free[entry.language].push(entry.state); taken.delete(id); }
  pool.frame++;
}
