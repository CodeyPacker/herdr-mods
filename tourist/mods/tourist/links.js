// file:line references in the agent's markdown, turned into links that move the code panel.
// A link points at a made-up https address that only Tourist reads; real links open in the browser.

const HOST = "https://tourist.invalid/line";

// A path with an extension, then :line or :start-end. Inline code and existing links are matched
// first so they are kept whole.
const REF = /((?:[\w.@-]+\/)*[\w.@-]+\.[A-Za-z0-9]+):(\d+)(?:[-–](\d+))?/;
const TOKEN = new RegExp(String.raw`(\[[^\]\n]*\]\([^)\n]*\))|` + "`([^`\\n]+)`|" + REF.source, "g");

/**
 * Turns `file:line` and `file:start-end` references into links. `resolve(path)` gives the repo
 * path a reference means, or null to leave it as text. Code blocks are left alone.
 */
export function linkify(text, resolve) {
  return String(text ?? "").split(/(```[\s\S]*?```)/).map((part, i) => i % 2 ? part : part.replace(TOKEN, (all, link, code) => {
    if (link) return all;
    const m = REF.exec(code ?? all);
    if (!m || (code && m[0] !== code.trim())) return all;
    const file = resolve(m[1]);
    if (!file) return all;
    const a = +m[2], b = Math.max(a, +(m[3] ?? m[2]));
    return `[${code ? `\`${code}\`` : all}](${HOST}?f=${encodeURIComponent(file)}&a=${a}&b=${b})`;
  })).join("");
}

/** `{ file, a, b }` for a Tourist link, or null for any other URL. */
export function readLink(url) {
  if (!String(url).startsWith(HOST)) return null;
  const q = {};
  for (const pair of String(url).split("?")[1]?.split("&") ?? []) {
    const [k, v = ""] = pair.split("=");
    q[k] = decodeURIComponent(v);
  }
  const a = Number(q.a) || 1;
  return { file: q.f ?? "", a, b: Math.max(a, Number(q.b) || a) };
}

/**
 * The repo path a reference means: an exact path, else the one file whose path ends with it.
 * When several end with it, `prefer` (the current file, then the tour's files) breaks the tie.
 */
export function resolver(files, prefer = []) {
  return ref => {
    const path = ref.replace(/^\.\//, "");
    if (files.has(path)) return path;
    const ends = [...files].filter(f => f.endsWith(`/${path}`));
    if (ends.length === 1) return ends[0];
    return prefer.find(f => ends.includes(f)) ?? null;
  };
}
