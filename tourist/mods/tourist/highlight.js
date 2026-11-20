// Rough syntax colors for code shown line by line. It is not a parser: it finds comments,
// strings, numbers, keywords, function calls and capitalized type names, which is enough to
// read code by. Each row gets `spans`: [{ text, kind }], kind being null for plain text.

const KEYWORDS = new Set((
  "abstract as async await break case catch class const continue def default defer del delete do elif else " +
  "enum export extends fn for from func function go if impl implements import in instanceof interface is let " +
  "match mod module mut new not of or and package pass private protected pub public raise return select " +
  "static struct switch throw throws trait try type typeof use var void where while with yield"
).split(" "));
const CONSTANTS = new Set("true false null undefined nil None True False this self Self super NaN Infinity".split(" "));
// Files whose comments start with #, and files that are prose or data rather than code.
const HASH = new Set(["py", "sh", "bash", "zsh", "fish", "rb", "yaml", "yml", "toml", "ps1", "r", "pl", "nix", "conf", "ini", "cfg"]);
const PLAIN = new Set(["md", "mdx", "txt", "rst", "csv", "tsv", "lock", "log", "svg"]);

/** How comments look in `file`, or null when the file isn't code. */
function styleOf(file) {
  const name = file.split("/").pop().toLowerCase(), ext = name.includes(".") ? name.split(".").pop() : name;
  if (PLAIN.has(ext)) return null;
  if (HASH.has(ext) || name === "dockerfile" || name === "makefile") return { line: "#", block: null };
  if (ext === "lua" || ext === "sql") return { line: "--", block: null };
  return { line: "//", block: ["/*", "*/"] };
}

const IDENT = /^[A-Za-z_$][\w$]*/;
const NUMBER = /^\d[\w.]*/;

/** One line's spans. `state.block` is true while inside a block comment; it carries to the next line. */
function lineSpans(line, style, state) {
  const spans = [];
  const push = (text, kind) => {
    const last = spans[spans.length - 1];
    if (last && last.kind === kind) last.text += text; else spans.push({ text, kind });
  };
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    if (state.block) {
      const end = rest.indexOf(style.block[1]);
      const n = end < 0 ? rest.length : end + style.block[1].length;
      push(rest.slice(0, n), "comment"); i += n;
      if (end >= 0) state.block = false;
      continue;
    }
    if (rest.startsWith(style.line)) { push(rest, "comment"); break; }
    if (style.block && rest.startsWith(style.block[0])) { state.block = true; push(style.block[0], "comment"); i += style.block[0].length; continue; }
    const c = rest[0];
    if (c === '"' || c === "'" || c === "`") {
      // A string ends at its closing quote on the same line. A lone quote is just a character.
      let j = 1;
      while (j < rest.length && rest[j] !== c) j += rest[j] === "\\" ? 2 : 1;
      if (j < rest.length) { push(rest.slice(0, j + 1), "string"); i += j + 1; continue; }
      push(c, null); i++; continue;
    }
    const prev = i > 0 ? line[i - 1] : "";
    const num = /[\w$]/.test(prev) ? null : NUMBER.exec(rest);
    if (num) { push(num[0], "number"); i += num[0].length; continue; }
    const id = /[\w$]/.test(prev) ? null : IDENT.exec(rest);
    if (id) {
      const word = id[0], after = rest.slice(word.length).trimStart()[0];
      const kind = KEYWORDS.has(word) ? "keyword" : CONSTANTS.has(word) ? "constant"
        : after === "(" ? "function" : /^[A-Z][a-z]/.test(word) ? "type" : null;
      push(word, kind); i += word.length; continue;
    }
    push(c, null); i++;
  }
  return spans;
}

/**
 * Adds `spans` to each numbered row of a diff or file excerpt. Removed and added lines keep a
 * block comment state of their own, so one side's open comment doesn't color the other.
 * A hunk header starts both afresh. Returns the rows.
 */
export function highlightRows(rows, file) {
  const style = styleOf(file);
  if (!style) return rows;
  let old = { block: false }, next = { block: false };
  for (const r of rows) {
    if (r.kind === "@") { old = { block: false }; next = { block: false }; continue; }
    if (r.number === undefined) continue;
    const text = r.text.replace(/\t/g, "    ");
    if (r.kind === "-") r.spans = lineSpans(text, style, old);
    else if (r.kind === "+") r.spans = lineSpans(text, style, next);
    else { r.spans = lineSpans(text, style, next); old = { ...next }; }
  }
  return rows;
}
