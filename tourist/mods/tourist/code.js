// Reading a stop's lines from disk, showing them, and opening them in VS Code.
import { EditorState } from "gpui-base";
import { exec, readTextFile, theme, settings, window } from "herdr";
import { LANG } from "./constants.js";

/** A stop's lines, with start and end clamped to the file. Null when the file can't be read. */
export async function readExcerpt(root, stop, on) {
  let text = null;
  try { text = await readTextFile(`${root}/${stop.file}`, { on }); } catch { text = null; }
  if (text === null) return null;
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, Number(stop.start) || 1);
  const end = Math.min(lines.length, Math.max(start, Number(stop.end) || start + 40));
  return { text: lines.slice(start - 1, end).join("\n"), start, end };
}

/** A read-only editor for `text`, highlighted by the file's extension. Release it when done. */
export function codeState(file, text) {
  const t = theme(), ext = file.includes(".") ? file.split(".").pop() : "txt";
  return EditorState.new({ language: LANG[ext] ?? ext, readonly: true, value: text, line_numbers: false,
    font_family: settings().font_family, font_size: 12,
    syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
}

/** Opens `path` at `line` in VS Code. Needs `code` on PATH. */
export function openInEditor(path, line) {
  const target = `${path}:${line}`;
  const win = window()?.platform === "windows";
  exec(win ? "cmd" : "code", win ? ["/c", "code", "-g", target] : ["-g", target]).catch(() => {});
}
