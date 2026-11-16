// Reading a stop's lines at the pinned commit, showing them, and opening the live file in VS Code.
import { EditorState } from "gpui-base";
import { exec, readTextFile, settings, window } from "herdr";
import { colors } from "./kit/theme.js";

/** A file's lines at `commit`, or null when git can't show it. */
export async function fileAt(root, commit, file) {
  const r = await exec("git", ["-C", root, "show", `${commit}:${file}`]).catch(() => null);
  if (!r || r.code !== 0) return null;
  return r.stdout.replace(/\r/g, "").replace(/\n$/, "").split("\n");
}

/** A read-only editor for `text`, highlighted by the file's extension through `grammar`. Release it when done. */
export function codeState(file, text, grammar = {}) {
  const t = colors(), ext = file.includes(".") ? file.split(".").pop() : "txt";
  return EditorState.new({ language: grammar[ext] ?? ext, readonly: true, value: text, line_numbers: false, folding: false,
    font_family: String(settings().font_family ?? ""), font_size: 12,
    syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
}

/** The line in the live file that holds `anchor`, else `fallback`. */
export async function liveLine(root, stop) {
  let text = null;
  try { text = await readTextFile(`${root}/${stop.file}`); } catch { text = null; }
  const at = text ? text.split(/\r?\n/).findIndex(l => l.includes(stop.anchor)) : -1;
  return at >= 0 ? at + 1 : stop.start;
}

/** Opens `path` at `line` in VS Code. Needs `code` on PATH. */
export function openInEditor(path, line) {
  const target = `${path}:${line}`;
  const win = window()?.platform === "windows";
  exec(win ? "cmd" : "code", win ? ["/c", "code", "-g", target] : ["-g", target]).catch(() => {});
}
