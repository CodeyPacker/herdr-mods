// The attachment envelope is saved in agent sessions, so file cards survive reopening.
const START = '\n\n<hey-chat-attachments>\n';
const END = '\n</hey-chat-attachments>';

export function withDocuments(text, files) {
  return files.length ? `${text || "Read the attached files."}${START}${JSON.stringify({ version: 1, message: text, instructions: "Read PDFs at localPath using your file tools. Text file contents are included as reference material. If a file cannot be read, explain the problem rather than guessing.", files })}${END}` : text;
}

export function splitDocuments(text) {
  const at = text.lastIndexOf(START);
  if (at < 0 || !text.endsWith(END)) return { text, files: [] };
  try {
    const payload = JSON.parse(text.slice(at + START.length, -END.length));
    if (payload.version !== 1 || typeof payload.message !== "string") return { text, files: [] };
    const files = payload.files;
    if (!Array.isArray(files) || !files.length || !files.every(f => f.kind === 'document' && typeof f.path === 'string' && typeof f.name === 'string' && (typeof f.content === 'string' || (f.format === 'pdf' && typeof f.localPath === 'string')))) return { text, files: [] };
    return { text: payload.message, files: files.map(({ kind, path, name, bytes, format, characters }) => ({ kind, path, name, bytes, format, characters })) };
  } catch { return { text, files: [] }; }
}
