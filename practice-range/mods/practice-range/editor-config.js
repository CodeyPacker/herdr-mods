/** @param {string | null} text @returns {Record<string, unknown>} */
export function parseConfig(text) {
  if (!text?.trim()) return {};
  let config;
  try { config = JSON.parse(text); }
  catch { throw new Error("practice-range.json must contain valid JSON. Set editor to neovim or vscode."); }
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("practice-range.json must contain a configuration object.");
  return config;
}

/** @param {string | null} text @returns {"neovim" | "vscode" | null} */
export function parseEditorConfig(text) {
  const config = parseConfig(text);
  if (config.editor === undefined || config.editor === null || config.editor === "") return null;
  if (config.editor !== "neovim" && config.editor !== "vscode") throw new Error('practice-range.json: editor must be "neovim" or "vscode".');
  return config.editor;
}

/**
 * Preserve unrelated settings and pass the exact previous text to the atomic writer.
 * @param {"neovim" | "vscode"} editor
 * @param {{ read: () => Promise<string | null>, write: (text: string, expected: string | null) => Promise<unknown> }} io
 */
export async function saveEditorConfig(editor, io) {
  const previous = await io.read();
  const config = parseConfig(previous);
  config.editor = editor;
  await io.write(JSON.stringify(config, null, 2) + "\n", previous);
}
