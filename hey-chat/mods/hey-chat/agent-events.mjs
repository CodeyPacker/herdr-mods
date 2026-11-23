// Bridge events from what Claude and Codex write. The live bridge (bridge.mjs) and saved history
// (sessions.mjs) both build them here, so a chat looks the same either way.
import { keepFile, keepBase64, pathsIn } from "./images.mjs";

/** An image event for a kept image, or null when it couldn't be kept. @param {{ path: string, w: number, h: number } | null} img */
export function imageEvent(img) {
  return img ? { type: "image", path: img.path, w: img.w, h: img.h } : null;
}

/**
 * The agent's words, then an image event for each image file they name by full path.
 * @param {string} text @param {string} dir the images folder
 */
export function textEvents(text, dir) {
  const images = pathsIn(text).map((file) => imageEvent(keepFile(file, dir))).filter(Boolean);
  return [{ type: "text", text }, ...images];
}

/** The note a compacted chat shows. @param {string | undefined} trigger "auto" when Claude compacted on its own */
export function compactNote(trigger) {
  return { type: "note", text: trigger === "auto" ? "Chat compacted automatically." : "Chat compacted." };
}

/**
 * The events in a Claude assistant message: its words and its tool calls.
 * @param {any[] | undefined} content the message's content @param {string} dir the images folder
 */
export function claudeAssistantEvents(content, dir) {
  return (content ?? []).flatMap((/** @type {any} */ c) => {
    if (c.type === "text" && c.text?.trim()) return textEvents(c.text, dir);
    if (c.type === "tool_use") return [{ type: "tool", id: c.id, name: c.name, input: c.input ?? {} }];
    return [];
  });
}

/**
 * The events in a Claude user message's tool results: each tool's end, with its output cut to
 * `max` characters, then each image the tool gave Claude (a Read of a picture, a screenshot).
 * @param {unknown} content the message's content @param {string} dir the images folder @param {number} max
 */
export function claudeToolResultEvents(content, dir, max) {
  if (!Array.isArray(content)) return [];
  return content.filter((c) => c.type === "tool_result").flatMap((c) => {
    const parts = Array.isArray(c.content) ? c.content : null;
    const out = parts ? parts.map((/** @type {any} */ x) => x.text ?? "").join("\n") : String(c.content ?? "");
    const images = (parts ?? []).filter((/** @type {any} */ x) => x.type === "image")
      .map((/** @type {any} */ x) => imageEvent(keepBase64(x.source?.data, x.source?.media_type, dir))).filter(Boolean);
    return [{ type: "tool_done", id: c.tool_use_id, error: Boolean(c.is_error), output: out.slice(0, max) }, ...images];
  });
}
