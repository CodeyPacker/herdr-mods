// Keep linked-message provenance when providers persist the prompt in their own sessions.
const START = '\n\n<hey-chat-sender>\n';
const END = '\n</hey-chat-sender>';
export function withSender(text, source) {
  return source ? `${text}${START}${JSON.stringify(source)}${END}` : text;
}
export function splitSender(text) {
  const at = text.lastIndexOf(START);
  if (at < 0 || !text.endsWith(END)) return { text, source: null };
  try {
    const source = JSON.parse(text.slice(at + START.length, -END.length));
    if (typeof source.chat !== 'string' || typeof source.title !== 'string' || !['agent', 'delegation', 'update'].includes(source.kind)) return { text, source: null };
    return { text: text.slice(0, at), source };
  } catch { return { text, source: null }; }
}
export function updateText(source) {
  // Older notices contain the entire brief in summary.task. Keep those compact too.
  return [`${source.title}: ${source.status ?? 'updated'}`,
    ...(source.blockers ?? []).map(s => `Blocked: ${s}`), ...(source.needs ?? []).map(s => `Needs: ${s}`)]
    .filter(Boolean).join('\n');
}
