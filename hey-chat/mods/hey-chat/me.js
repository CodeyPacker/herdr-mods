// Your profile: initials, their color, and a picture (a built-in one or your own photo).
// Kept in Herdr's shared state, which every copy sees and which lasts across restarts.
// A photo is copied into <appHome>/data/hey-chat/, cropped square and shrunk where the system can.
import { shared, setShared, exec, appHome, window } from "herdr";

const KEY = "hey-chat.me";

/** @typedef {{ initials: string, color: string, picture: string | null }} Me */

/** The initials colors Settings offers. The first is the default. */
export const COLORS = ["#7c5cff", "#2f6fe4", "#0f7a5e", "#c2410c", "#be185d", "#475569"];

/** The built-in pictures, as paths image() takes. */
export const PICTURES = ["sunset", "mountains", "waves", "orbit", "bloom", "blocks"]
  .map((name) => ({ name, path: `mods/hey-chat/pictures/${name}.svg` }));

/** Image types a photo can be. */
const PHOTO = /\.(png|jpe?g|gif|webp|heic|heif|tiff?|bmp)$/i;

/** @returns {Me} */
export function loadMe() {
  const s = /** @type {any} */ (shared(KEY));
  return {
    initials: typeof s?.initials === "string" ? s.initials : "Me",
    color: typeof s?.color === "string" ? s.color : COLORS[0],
    picture: typeof s?.picture === "string" ? s.picture : null,
  };
}

/** @param {Me} me */
export function saveMe(me) {
  setShared(KEY, { initials: me.initials, color: me.color, picture: me.picture });
}

/** True when `path` names an image a photo can be. @param {string} path */
export function isPhoto(path) {
  return PHOTO.test(path);
}

/** True when `picture` is a photo of yours, not a built-in picture. @param {string | null} picture */
function isOwnPhoto(picture) {
  return Boolean(picture?.startsWith("data/hey-chat/"));
}

/**
 * Asks for a photo with the system's file dialog. Resolves with its path, or null when cancelled
 * or when this system has no dialog Hey, chat knows (then dropping a picture on Settings still works).
 * @returns {Promise<string | null>}
 */
export async function pickPhoto() {
  const platform = window().platform;
  const wait = { timeout: 600000 };
  try {
    if (platform === "macos") {
      const r = await exec("osascript", ["-e", 'POSIX path of (choose file with prompt "Pick a picture" of type {"public.image"})'], wait);
      return r.code === 0 && r.stdout.trim() ? r.stdout.trim() : null;
    }
    if (platform === "linux") {
      const r = await exec("zenity", ["--file-selection", "--title=Pick a picture", "--file-filter=Images | *.png *.jpg *.jpeg *.gif *.webp"], wait);
      return r.code === 0 && r.stdout.trim() ? r.stdout.trim() : null;
    }
  } catch { /* no dialog program */ }
  return null;
}

/**
 * Copies a photo in as your picture and removes the one it replaces. On macOS it is cropped to a
 * centered square and saved as a 192 px JPEG. Elsewhere it is copied as it is.
 * Resolves with the picture's path for image(), or throws with a message to show.
 * @param {string} src @param {string | null} old the picture it replaces
 * @returns {Promise<string>}
 */
export async function importPhoto(src, old) {
  if (!isPhoto(src)) throw new Error("That isn't a picture Hey, chat can use.");
  const home = appHome();
  const dir = `${home}/data/hey-chat`;
  const mac = window().platform === "macos";
  const ext = mac ? "jpg" : (src.match(PHOTO)?.[1] ?? "png").toLowerCase();
  const name = `me-${Date.now()}.${ext}`;
  const out = `${dir}/${name}`;
  if (window().platform === "windows") {
    await exec("cmd", ["/c", "mkdir", dir.replace(/\//g, "\\")]).catch(() => null);
    const r = await exec("cmd", ["/c", "copy", "/y", src, out.replace(/\//g, "\\")]);
    if (r.code !== 0) throw new Error("Couldn't copy that picture.");
  } else {
    await exec("mkdir", ["-p", dir]);
    if (mac) {
      const dims = await exec("sips", ["-g", "pixelWidth", "-g", "pixelHeight", src]);
      const w = Number(/pixelWidth:\s*(\d+)/.exec(dims.stdout)?.[1]);
      const h = Number(/pixelHeight:\s*(\d+)/.exec(dims.stdout)?.[1]);
      if (!w || !h) throw new Error("Couldn't read that picture.");
      const side = String(Math.min(w, h));
      const crop = await exec("sips", ["-s", "format", "jpeg", "-c", side, side, src, "--out", out]);
      if (crop.code !== 0) throw new Error("Couldn't read that picture.");
      await exec("sips", ["-Z", "192", out]);
    } else {
      const r = await exec("cp", [src, out]);
      if (r.code !== 0) throw new Error("Couldn't copy that picture.");
    }
  }
  if (isOwnPhoto(old)) await removeFile(`${home}/${old}`);
  return `data/hey-chat/${name}`;
}

/** Removes your old photo's file when you go back to initials or a built-in picture. @param {string | null} old */
export async function dropPhoto(old) {
  if (isOwnPhoto(old)) await removeFile(`${appHome()}/${old}`);
}

/** @param {string} path */
async function removeFile(path) {
  const win = window().platform === "windows";
  await (win ? exec("cmd", ["/c", "del", "/q", path.replace(/\//g, "\\")]) : exec("rm", ["-f", path])).catch(() => null);
}
