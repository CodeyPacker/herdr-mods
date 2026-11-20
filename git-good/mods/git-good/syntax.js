// Colors for code in the diff: splits one line into pieces and says what each piece is.
// It reads a line at a time and knows only words, strings, comments and numbers, so it is a
// close guess, not a parser. No imports, so plain node can load this file.

/** What a piece of a line is. "" is plain text. @typedef {"" | "keyword" | "string" | "comment" | "number" | "function" | "type" | "constant"} Kind */
/** One piece of a line. @typedef {{ kind: Kind, text: string }} Token */
/** A comment or string still open at a line's end: what closes it, and what it is. @typedef {{ end: string, kind: Kind } | null} Open */

/**
 * How one family of languages is written.
 * @typedef {object} Language
 * @property {string[]} line what starts a comment that runs to the line's end
 * @property {[string, string][]} block pairs that open and close something that can span lines
 * @property {Kind[]} blockKind what each pair of `block` holds
 * @property {string} quotes each letter opens and closes a string on one line
 * @property {Set<string>} words the keywords
 * @property {boolean} [regex] a slash can start a pattern, as in JavaScript
 * @property {boolean} [fold] keywords match in any case, as in SQL
 */

/** @param {string} s */
const words = (s) => new Set(s.split(" "));

const CONSTANTS = words("true false null undefined NaN Infinity None True False nil NULL TRUE FALSE this self super");

/** @type {Language} */
const JS = {
  line: ["//"], block: [["/*", "*/"], ["`", "`"]], blockKind: ["comment", "string"], quotes: "\"'", regex: true,
  words: words("as async await break case catch class const continue debugger declare default delete do else enum export extends finally for from function get if implements import in instanceof interface is keyof let namespace new of private protected public readonly return satisfies set static switch throw try type typeof var void while with yield"),
};
/** @type {Language} */
const C_LIKE = {
  line: ["//"], block: [["/*", "*/"]], blockKind: ["comment"], quotes: "\"'",
  words: words("abstract as async await auto bool break byte case catch chan char class const continue crate def default defer delete do double dyn else enum explicit extends extern final finally float fn for foreach func fun go goto if impl implements import in include inline int interface internal is let long loop map match mod mut namespace new object operator override package private protected pub public range readonly ref return sealed select short signed sizeof static string struct switch template throw throws trait try type typedef union unsafe unsigned use using val var virtual void volatile when where while yield"),
};
/** @type {Language} */
const GO = { ...C_LIKE, block: [["/*", "*/"], ["`", "`"]], blockKind: ["comment", "string"] };
/** @type {Language} */
const RUST = { ...C_LIKE, quotes: "\"" };
/** @type {Language} */
const CSS = { line: [], block: [["/*", "*/"]], blockKind: ["comment"], quotes: "\"'", words: words("important") };
/** @type {Language} */
const SCSS = { ...CSS, line: ["//"] };
/** @type {Language} */
const JSON_LIKE = { line: ["//"], block: [["/*", "*/"]], blockKind: ["comment"], quotes: "\"", words: new Set() };
/** @type {Language} */
const PYTHON = {
  line: ["#"], block: [["\"\"\"", "\"\"\""], ["'''", "'''"]], blockKind: ["string", "string"], quotes: "\"'",
  words: words("and as assert async await break case class continue def del elif else except finally for from global if import in is lambda match nonlocal not or pass raise return try while with yield"),
};
/** @type {Language} */
const SCRIPT = {
  line: ["#"], block: [], blockKind: [], quotes: "\"'",
  words: words("alias begin break case class continue def do done elif else elsif end ensure esac export fi for foreach function if in local module param require rescue return then unless until when while yield"),
};
/** @type {Language} */
const CONFIG = { line: ["#"], block: [], blockKind: [], quotes: "\"'", words: new Set() };
/** @type {Language} */
const SQL = {
  line: ["--"], block: [["/*", "*/"]], blockKind: ["comment"], quotes: "'", fold: true,
  words: words("add all alter and as asc begin between by case column commit constraint create default delete desc distinct drop else end exists foreign from group having if in index inner insert into is join key left like limit not on or order outer primary references right rollback select set table then union unique update values view when where with"),
};

/** The language of each file ending. @type {Record<string, Language>} */
const BY_ENDING = {
  js: JS, mjs: JS, cjs: JS, jsx: JS, ts: JS, mts: JS, cts: JS, tsx: JS,
  c: C_LIKE, h: C_LIKE, cc: C_LIKE, cpp: C_LIKE, hpp: C_LIKE, cs: C_LIKE, java: C_LIKE, kt: C_LIKE, swift: C_LIKE, php: C_LIKE, dart: C_LIKE, scala: C_LIKE,
  go: GO, rs: RUST, css: CSS, scss: SCSS, less: SCSS, json: JSON_LIKE, jsonc: JSON_LIKE,
  py: PYTHON, rb: SCRIPT, sh: SCRIPT, bash: SCRIPT, zsh: SCRIPT, ps1: SCRIPT, psm1: SCRIPT,
  yml: CONFIG, yaml: CONFIG, toml: CONFIG, ini: CONFIG, conf: CONFIG, env: CONFIG, sql: SQL,
};
/** The language of each whole file name, in small letters. @type {Record<string, Language>} */
const BY_NAME = { dockerfile: SCRIPT, makefile: SCRIPT, ".gitignore": CONFIG, ".gitattributes": CONFIG, ".env": CONFIG };

/**
 * The language a file is written in, or null when its lines stay plain.
 * @param {string} path @returns {Language | null}
 */
export function languageOf(path) {
  const name = String(path ?? "").split("/").pop()?.toLowerCase() ?? "";
  if (BY_NAME[name]) return BY_NAME[name];
  const dot = name.lastIndexOf(".");
  return dot < 0 ? null : BY_ENDING[name.slice(dot + 1)] ?? null;
}

const WORD = /[A-Za-z_$][\w$]*/y;
const NUMBER = /\d[\w.]*/y;
const SPACE = /\s+/y;

/**
 * Splits one line into pieces. Spaces go with the piece after them.
 * @param {string} text the line @param {Language} lang
 * @param {Open} open what the line before left open
 * @returns {{ tokens: Token[], open: Open }} `open` is what this line leaves open
 */
export function tokenize(text, lang, open) {
  /** @type {Token[]} */
  const tokens = [];
  let space = ""; // spaces waiting for the next piece
  /** @param {Kind} kind @param {string} s */
  const push = (kind, s) => {
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += space + s;
    else tokens.push({ kind, text: space + s });
    space = "";
  };
  /** True where a slash starts a pattern and not a division: after nothing, or after a sign. */
  const patternFits = () => {
    const last = tokens[tokens.length - 1];
    return !last || (last.kind === "" && !/[\w$)\]]$/.test(last.text)) || last.kind === "keyword";
  };
  let i = 0;
  while (i < text.length) {
    if (open) {
      const at = text.indexOf(open.end, i);
      if (at < 0) { push(open.kind, text.slice(i)); return { tokens, open }; }
      push(open.kind, text.slice(i, at + open.end.length));
      i = at + open.end.length;
      open = null;
      continue;
    }
    SPACE.lastIndex = i;
    const gap = SPACE.exec(text);
    if (gap) { space += gap[0]; i += gap[0].length; continue; }
    if (lang.line.some((s) => text.startsWith(s, i))) { push("comment", text.slice(i)); break; }
    const b = lang.block.findIndex(([start]) => text.startsWith(start, i));
    if (b >= 0) {
      const [start, end] = lang.block[b];
      push(lang.blockKind[b], start);
      i += start.length;
      open = { end, kind: lang.blockKind[b] };
      continue;
    }
    const c = text[i];
    if (lang.quotes.includes(c) || (c === "/" && lang.regex && patternFits() && text.indexOf("/", i + 1) > 0)) {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      push("string", text.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    NUMBER.lastIndex = i;
    const n = NUMBER.exec(text);
    if (n) { push("number", n[0]); i += n[0].length; continue; }
    WORD.lastIndex = i;
    const w = WORD.exec(text);
    if (w) {
      const word = w[0];
      i += word.length;
      if (lang.words.has(lang.fold ? word.toLowerCase() : word)) push("keyword", word);
      else if (CONSTANTS.has(word)) push("constant", word);
      else if (/^\s*\(/.test(text.slice(i, i + 8))) push("function", word);
      else if (/^[A-Z]/.test(word)) push("type", word);
      else push("", word);
      continue;
    }
    push("", c);
    i++;
  }
  if (space) push("", "");
  return { tokens, open };
}

/**
 * Gives every code line of a diff its pieces, as `tokens` on the row (unified view) or on each
 * side (split view). The old and the new file are read apart, so a comment opened by a removed
 * line does not run into the added lines. Each hunk starts fresh.
 * @param {any[]} rows from unifiedRows or splitRows @param {Language | null} lang
 */
export function colorRows(rows, lang) {
  if (!lang) return;
  /** @type {Open} */
  let old = null;
  /** @type {Open} */
  let next = null;
  /** @param {{ kind: string, text: string, tokens?: Token[] }} line */
  const color = (line) => {
    const side = line.kind === "-" ? old : next;
    const r = tokenize(line.text, lang, side);
    line.tokens = r.tokens;
    if (line.kind !== "+") old = line.kind === "-" ? r.open : tokenize(line.text, lang, old).open;
    if (line.kind !== "-") next = r.open;
  };
  for (const row of rows) {
    if (row.kind === "@") { old = null; next = null; }
    else if (row.kind === "pair") {
      // A line both files have is on both sides: read it once, and give the left side the same pieces.
      if (row.left && row.right && row.left.kind === " ") { color(row.right); row.left.tokens = row.right.tokens; }
      else { if (row.left) color(row.left); if (row.right) color(row.right); }
    } else if (row.kind !== "") color(row);
  }
}
