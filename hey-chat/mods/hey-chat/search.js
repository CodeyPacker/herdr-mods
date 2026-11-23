/** Escape message text before passing it to the native HTML text renderer. */
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Underline literal, case-insensitive matches without treating the query as a pattern. */
export function markedText(text, query, html = true) {
  const source = String(text ?? "");
  const needle = query.trim();
  const escape = html ? escapeHtml : value => value;
  if (!needle) return escape(source);
  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
  let result = "", start = 0;
  for (const match of source.matchAll(pattern)) {
    result += escape(source.slice(start, match.index)) + `<u>${escapeHtml(match[0])}</u>`;
    start = match.index + match[0].length;
  }
  return result + escape(source.slice(start));
}

/** Preserve Markdown links and code while inserting underlines into their visible text. */
export function markedMarkdown(text, query) {
  if (!query.trim() || !text.toLowerCase().includes(query.trim().toLowerCase())) return text;
  const tokens = /(```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~|`[^`\n]+`|!?\[[^\]\n]*\]\([^\n)]*\)|<[^>\n]*>|https?:\/\/[^\s)]+)/g;
  let result = "", start = 0;
  for (const match of text.matchAll(tokens)) {
    result += markedText(text.slice(start, match.index), query, false);
    const token = match[0];
    if (token.startsWith("```") || token.startsWith("~~~")) {
      const content = token.slice(token.indexOf("\n") + 1, -3);
      result += `<pre><code>${markedText(content, query)}</code></pre>`;
    } else if (token.startsWith("`")) result += `<code>${markedText(token.slice(1, -1), query)}</code>`;
    else if (token.startsWith("[")) {
      const end = token.indexOf("](");
      result += `[${markedText(token.slice(1, end), query, false)}]${token.slice(end + 1)}`;
    } else result += token;
    start = match.index + token.length;
  }
  return result + markedText(text.slice(start), query, false);
}
