// Outputs belong to a conversation, regardless of which agent produced them.
const TYPES = /\.(?:html?|md|markdown|txt|csv|json|ya?ml|svg|png|jpe?g|gif|webp|pdf|docx?|xlsx?|pptx?)(?:$|[?#])/i;

export function webOutput(target, label) {
  if (!/^https?:\/\/[^\s/]+(?:\/|$)/i.test(target) || /[<>"'\x00-\x20]/.test(target)) return null;
  const host = target.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
  const claude = /^(?:www\.)?claude\.(?:ai|com)(?::\d+)?$/.test(host) && /\/[^?#]*artifacts?\b/i.test(target);
  return { key: `url:${target}`, target, label: label || (claude ? 'Claude artifact' : host), kind: 'link', provider: claude ? 'Claude' : null };
}

export function fileOutput(target, cwd, home = '') {
  try { target = decodeURIComponent(target); } catch { /* Keep literal file names. */ }
  target = target.replace(/\\/g, '/').replace(/:\d+(?::\d+)?$/, '');
  if (!TYPES.test(target) || /^[a-z]+:/i.test(target) && !/^[a-z]:\//i.test(target) || /[\x00-\x1f]/.test(target)) return null;
  if (target.startsWith('~/')) { if (!home) return null; target = home + target.slice(1); }
  if (!target.startsWith('/') && !/^[a-z]:\//i.test(target)) target = `${cwd}/${target}`;
  const drive = target.match(/^[a-z]:/i)?.[0] ?? '';
  const parts = [];
  for (const part of target.slice(drive.length).split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  target = `${drive}/${parts.join('/')}`;
  const ext = target.split('.').pop().toLowerCase();
  const kind = /^(png|jpe?g|gif|webp)$/.test(ext) ? 'image' : /^(md|markdown)$/.test(ext) ? 'markdown'
    : /^(txt|csv|json|ya?ml)$/.test(ext) ? 'text' : 'file';
  return { key: `file:${drive ? target.toLowerCase() : target}`, target, label: parts.at(-1), kind };
}

/** Rebuild from history, retaining previously discovered outputs when history is trimmed. */
export function collectOutputs(chat, home = '') {
  const saved = new Map((chat.outputs ?? []).map(o => [o.key, o]));
  const found = new Map();
  const add = (output, m) => {
    if (!output) return;
    found.delete(output.key);
    found.set(output.key, { ...output, message: m.id });
  };
  for (const m of chat.thread ?? []) {
    if (m.kind === 'tool' && m.icon === 'edit' && !m.running && !m.failed) {
      for (const file of m.lines ?? []) add(fileOutput(file, chat.cwd, home), m);
    }
    if (m.kind !== 'text') continue;
    const text = m.text ?? '';
    for (const match of text.matchAll(/\[([^\]\n]+)\]\(([^)\n]+)\)/g)) {
      const target = match[2].replace(/^<|>$/g, '');
      if (/^https?:/i.test(target)) {
        const output = webOutput(target, match[1]);
        if (output && (output.provider || /\b(?:output|preview|artifact|report|dashboard|download|prototype|design)\b/i.test(match[1]) || TYPES.test(target) || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/)/i.test(target))) add(output, m);
      } else {
        const output = fileOutput(target, chat.cwd, home);
        if (output) add({ ...output, label: match[1] }, m);
      }
    }
    for (const match of text.matchAll(/https?:\/\/[^\s<>"'`)\]]+/g)) {
      const target = match[0].replace(/[.,;!?]+$/, '');
      const output = webOutput(target);
      if (output && (output.provider || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/)/i.test(target))) {
        if (found.get(output.key)?.message !== m.id) add(output, m);
      }
    }
    if (m.from !== 'agent') continue;
    for (const match of text.matchAll(/`([^`\n]+)`/g)) {
      if (TYPES.test(match[1]) && !/\s/.test(match[1])) add(fileOutput(match[1], chat.cwd, home), m);
    }
  }
  for (const output of found.values()) {
    const previous = saved.get(output.key);
    saved.set(output.key, { ...output, updated: previous?.message === output.message ? previous.updated : Date.now() });
  }
  return [...saved.values()].sort((a, b) => b.updated - a.updated || a.key.localeCompare(b.key));
}
