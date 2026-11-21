// What differs between Windows, macOS and Linux: opening a URL in its default app and copying a
// file. Call these from handlers or tasks: window() needs a host call.
import { window as win, exec } from "herdr";

export const isWindows = () => win()?.platform === "windows";

export function fileUrl(path) {
  if (/^[A-Za-z]:\//.test(path)) return "file:///" + encodeURI(path);
  return "file://" + encodeURI(path);
}

// The default browser, or the default app for a file or obsidian:// URL.
export function openExternal(target) {
  const p = win()?.platform;
  const [cmd, args] = p === "windows" ? ["rundll32", ["url.dll,FileProtocolHandler", target]]
    : p === "macos" ? ["open", [target]] : ["xdg-open", [target]];
  return exec(cmd, args).catch(() => {});
}

// Copies the file `name` from one folder to another, making the target folder. Paths use "/".
// The mod's own fs.writeFile writes 0 bytes for binary data (app 0.1.x), so the system copies.
// Rejects with a message fit to show.
export async function copyFile(fromDir, toDir, name) {
  if (isWindows()) {
    // robocopy skips a file that is already the same, and exits below 8 when nothing failed.
    const w = (p) => p.replace(/\//g, "\\");
    const r = await exec("robocopy", [w(fromDir), w(toDir), name, "/NJH", "/NJS", "/NP", "/NFL", "/NDL", "/R:0", "/W:0"]);
    if (r.code >= 8) throw new Error((r.stdout || r.stderr || "copy failed").trim());
    return;
  }
  const r = await exec("sh", ["-c", 'mkdir -p "$2" && cp -p "$1/$3" "$2/"', "vaultr", fromDir, toDir, name]);
  if (r.code !== 0) throw new Error((r.stderr || "copy failed").trim());
}
