// Obsidian markdown -> segments TextView can draw. Pure: no herdr imports, so node can test it.

const IMAGE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;
const SCHEME = "vaultr://open/";
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export const isImage = (path) => IMAGE.test(path);
export const linkUrl = (target) => SCHEME + encodeURIComponent(target);

// The wikilink target a clicked URL names, or null for any other URL.
export function parseLink(url) {
  const at = url.indexOf(SCHEME);
  if (at < 0) return null;
  try { return decodeURIComponent(url.slice(at + SCHEME.length)); } catch { return null; }
}

// "Note#Heading" -> { note: "Note", heading: "Heading" | null }
export function splitTarget(target) {
  const at = target.indexOf("#");
  return at < 0 ? { note: target.trim(), heading: null } : { note: target.slice(0, at).trim(), heading: target.slice(at + 1).trim() || null };
}

export const headingKey = (text) => text.replace(/[*_`=\[\]]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function splitFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  return m ? { front: m[1], body: text.slice(m[0].length) } : { front: null, body: text };
}

// "Note#Heading|Alias" -> { target: "Note#Heading", label: "Alias" }
function parts(inner) {
  const [target, alias] = inner.split(/\\?\|/);
  return { target: target.trim(), label: (alias ?? target.replace(/^#/, "").replace(/#/g, " > ")).trim() };
}

function safeDecode(s) { try { return decodeURI(s); } catch { return s; } }

// Every link target in a note (wikilinks, embeds and relative markdown links), for the backlink index.
export function linkTargets(text) {
  const out = [];
  for (const m of text.matchAll(/\[\[([^\]\n]+)\]\]/g)) out.push(parts(m[1]).target);
  for (const m of text.matchAll(/(?<!!)\[[^\]\n]*\]\(([^)\s]+)[^)\n]*\)/g)) {
    if (!HAS_SCHEME.test(m[1]) && !m[1].startsWith("#")) out.push(safeDecode(m[1]));
  }
  return out;
}

function inline(text) {
  return text
    .replace(/%%.*?%%/g, "")
    .replace(/==(.+?)==/g, "**$1**")
    // A markdown link to a file in the vault opens in the mod, like a wikilink.
    .replace(/(?<!!)\[([^\]\n]*)\]\(([^)\s]+)[^)\n]*\)/g, (m, label, href) => (HAS_SCHEME.test(href) ? m : `[${label}](${linkUrl(href.startsWith("#") ? href : safeDecode(href))})`))
    .replace(/!\[\[([^\]\n]+)\]\]/g, (_m, inner) => { const p = parts(inner); return `[↪ ${p.target}](${linkUrl(p.target)})`; })
    .replace(/\[\[([^\]\n]+)\]\]/g, (_m, inner) => { const p = parts(inner); return `[${p.label}](${linkUrl(p.target)})`; });
}

// Leaves `code spans` alone.
const line = (text) => text.split(/(`[^`]*`)/).map((s, i) => (i % 2 ? s : inline(s))).join("");

// -> [{ type: "md", text, heading? } | { type: "image", target }]
// A heading starts a new segment, so the view can scroll to it; `heading` is its headingKey.
export function transform(body) {
  const segs = [];
  let buf = [];
  let heading = null;
  let fence = null;
  const flush = () => {
    if (buf.join("").trim()) segs.push(heading ? { type: "md", text: buf.join("\n"), heading } : { type: "md", text: buf.join("\n") });
    buf = []; heading = null;
  };
  for (const raw of body.split(/\r?\n/)) {
    const f = /^\s*(`{3,}|~{3,})/.exec(raw);
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; buf.push(raw); continue; }
    if (fence) { buf.push(raw); continue; }
    const h = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(raw);
    if (h) { flush(); heading = headingKey(h[1]); buf.push(line(raw)); continue; }
    const callout = /^(\s*>\s*)\[!(\w+)\][+-]?\s*(.*)$/.exec(raw);
    if (callout) {
      const kind = callout[2][0].toUpperCase() + callout[2].slice(1).toLowerCase();
      buf.push(`${callout[1]}**${kind}${callout[3] ? ": " + line(callout[3]) : ""}**`);
      continue;
    }
    // An image becomes its own segment: TextView draws nothing for ![alt](path) or ![[file]].
    const pieces = raw.split(/(!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\([^)\n]+\))/);
    for (const piece of pieces) {
      const m = /^!\[\[([^\]\n]+)\]\]$/.exec(piece);
      const std = /^!\[[^\]\n]*\]\(([^)\s]+)[^)]*\)$/.exec(piece);
      const target = m ? parts(m[1]).target : std && !HAS_SCHEME.test(std[1]) ? safeDecode(std[1]) : null;
      if (target && isImage(target)) { flush(); segs.push({ type: "image", target }); }
      else if (pieces.length === 1 || piece.trim()) buf.push(line(piece));
    }
  }
  flush();
  return segs;
}
