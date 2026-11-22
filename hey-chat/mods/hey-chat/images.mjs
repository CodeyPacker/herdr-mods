#!/usr/bin/env node
// Images in chats. Herdr draws only images under its home (~/.config/herdr-app), so each image a
// chat shows is copied into <home>/data/hey-chat/images first, named by its contents.
//
//   node images.mjs paste --dir <images dir> [--file <path>]
//       Saves the clipboard's image there and prints { path, w, h }, or { error }. With --file (an
//       image file whose path was pasted, as Messages and Finder copy them), that file is copied
//       instead, and the clipboard's image is the fallback when macOS won't let it be read.
//   node images.mjs file --dir <images dir> --file <path>
//       Copies an image file there (a dropped one), cut down like a pasted one. Prints the same.
//
// bridge.mjs and sessions.mjs import the rest.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

/** Where image() finds the images, from Herdr's home. */
export const REL = "data/hey-chat/images";
/** The biggest image file a chat copies in. */
const MAX_BYTES = 20 * 1024 * 1024;
/** The longest side a pasted image is cut down to, so Claude and Codex take it. */
const MAX_SIDE = 2000;

const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

/** An image's media type from its file name, or null when it isn't one. @param {string} file */
export function mediaType(file) {
  return TYPES[extname(file).slice(1).toLowerCase()] ?? null;
}

/** An image's width and height from its first bytes, or null. @param {Buffer} b */
export function size(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF") return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
    if (kind === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    // JPEG: walk the segments to the frame header (SOF0–SOF15, not DHT, JPG or DAC).
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/**
 * Copies image bytes into the images folder, once per image, and returns how a chat shows it.
 * @param {Buffer} bytes @param {string} ext @param {string} dir
 * @returns {{ path: string, w: number, h: number } | null}
 */
export function keepBytes(bytes, ext, dir) {
  const dims = size(bytes);
  if (!dims || bytes.length > MAX_BYTES) return null;
  const name = `${createHash("sha1").update(bytes).digest("hex").slice(0, 20)}.${ext === "jpeg" ? "jpg" : ext}`;
  try {
    mkdirSync(dir, { recursive: true });
    if (!existsSync(join(dir, name))) writeFileSync(join(dir, name), bytes);
  } catch { return null; }
  return { path: `${REL}/${name}`, ...dims };
}

/** Copies an image file in. @param {string} file @param {string} dir */
export function keepFile(file, dir) {
  if (!mediaType(file)) return null;
  try {
    if (statSync(file).size > MAX_BYTES) return null;
    return keepBytes(readFileSync(file), extname(file).slice(1).toLowerCase(), dir);
  } catch { return null; }
}

/** Copies in an image given as base64 with its media type. @param {string} data @param {string} type @param {string} dir */
export function keepBase64(data, type, dir) {
  const ext = Object.entries(TYPES).find(([, t]) => t === type)?.[0];
  if (!ext || typeof data !== "string") return null;
  return keepBytes(Buffer.from(data, "base64"), ext, dir);
}

/** Copies in an image given as a data: URL. @param {string} url @param {string} dir */
export function keepDataUrl(url, dir) {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(String(url ?? ""));
  return m ? keepBase64(m[2], m[1], dir) : null;
}

/**
 * The image files a message names by full path (`/…/shot.png` or `~/…/shot.png`) that exist,
 * each once, in the order they appear.
 * @param {string} text
 */
export function pathsIn(text) {
  const out = [];
  const re = /(?:^|[\s`'"(<[])((?:~|\/)[^\s`'"()<>[\]]*\.(?:png|jpe?g|gif|webp))(?=$|[\s`'")>\].,:;!?])/gi;
  for (const m of String(text ?? "").matchAll(re)) {
    const file = resolve(m[1].startsWith("~") ? join(homedir(), m[1].slice(1)) : m[1]);
    if (!out.includes(file) && existsSync(file)) out.push(file);
  }
  return out;
}

/** The file a kept image lives in. @param {string} path its path from Herdr's home @param {string} dir */
export function fileOf(path, dir) {
  return join(dir, String(path).split("/").pop() ?? "");
}

/** Cuts a big image down in place (macOS), so the agents take it. @param {string} file */
function shrink(file) {
  if (process.platform !== "darwin") return;
  const dims = size(readFileSync(file));
  if (dims && Math.max(dims.w, dims.h) > MAX_SIDE) spawnSync("sips", ["-Z", String(MAX_SIDE), file], { stdio: "ignore" });
}

/**
 * Copies an image file in, cut down like a pasted one. A file macOS won't let Herdr read says so.
 * @param {string} file @param {string} dir
 * @returns {{ path: string, w: number, h: number } | { error: string, blocked?: boolean }}
 */
function takeFile(file, dir) {
  if (!mediaType(file)) return { error: "That isn't an image." };
  const tmp = join(tmpdir(), `hey-chat-file-${process.pid}${extname(file).toLowerCase()}`);
  try {
    writeFileSync(tmp, readFileSync(file));
    shrink(tmp);
    return keepFile(tmp, dir) ?? { error: "Couldn't read that image." };
  } catch (e) {
    const blocked = /EPERM|EACCES/.test(String(/** @type {any} */ (e)?.code));
    return blocked ? { error: "macOS won't let Herdr open that file. Give Herdr Full Disk Access in System Settings.", blocked } : { error: "Couldn't read that image." };
  } finally { rmSync(tmp, { force: true }); }
}

/** Saves the clipboard's image, or the pasted image file, into `dir`. @param {string} dir @param {string} [file] */
function paste(dir, file) {
  let blocked = false;
  if (file && mediaType(file)) {
    const kept = takeFile(file, dir);
    if (!("error" in kept)) return kept;
    blocked = Boolean(kept.blocked);
  }
  const got = pasteData(dir);
  if (!("error" in got) || !blocked) return got;
  return { error: "macOS won't let Herdr open that file. Give Herdr Full Disk Access in System Settings, or copy the image itself." };
}

/** Saves the clipboard's image data into `dir`. @param {string} dir */
function pasteData(dir) {
  const tmp = join(tmpdir(), `hey-chat-paste-${process.pid}.png`);
  try {
    if (process.platform === "darwin") {
      const script = [
        `set f to open for access POSIX file ${JSON.stringify(tmp)} with write permission`,
        "try",
        "  write (the clipboard as «class PNGf») to f",
        "end try",
        "close access f",
      ].join("\n");
      spawnSync("osascript", ["-e", script], { stdio: "ignore" });
      if (existsSync(tmp)) shrink(tmp);
    } else if (process.platform === "win32") {
      const script = `$path = '${tmp.replace(/'/g, "''")}'; Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $image = [Windows.Forms.Clipboard]::GetImage(); if ($image) { try { $image.Save($path, [Drawing.Imaging.ImageFormat]::Png) } finally { $image.Dispose() } }`;
      // Encode the script and quote the path as a literal for spaces and apostrophes.
      spawnSync("powershell.exe", ["-NoProfile", "-STA", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { windowsHide: true });
    } else {
      const r = spawnSync("sh", ["-c", "wl-paste --type image/png 2>/dev/null || xclip -selection clipboard -t image/png -o 2>/dev/null"], { maxBuffer: MAX_BYTES });
      if (r.stdout?.length) writeFileSync(tmp, r.stdout);
    }
    if (!existsSync(tmp) || statSync(tmp).size === 0) return { error: "The clipboard has no image." };
    return keepFile(tmp, dir) ?? { error: "Couldn't read the clipboard's image." };
  } finally {
    rmSync(tmp, { force: true });
  }
}

// Run directly, not imported. Herdr's mods folder links here, so both paths are resolved first.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [mode, ...rest] = process.argv.slice(2);
  /** @type {Record<string, string>} */
  const opts = {};
  for (let i = 0; i < rest.length; i++) if (rest[i].startsWith("--")) opts[rest[i].slice(2)] = rest[++i] ?? "";
  if (mode === "paste" && opts.dir) process.stdout.write(JSON.stringify(paste(opts.dir, opts.file)));
  else if (mode === "file" && opts.dir && opts.file) process.stdout.write(JSON.stringify(takeFile(opts.file, opts.dir)));
}
