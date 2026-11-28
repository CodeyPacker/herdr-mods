import { shared } from "herdr";
import { remember } from "./common.js";
import { seeThroughOpacity } from "./kit/theme.js";

const KEY = "hey-chat.messageColors";
export const COLOR_FIELDS = ["userBackground", "userText", "agentBackground", "agentText"];
export const MESSAGE_PALETTE = ["#111827", "#334155", "#2563eb", "#7c3aed", "#059669", "#dc2626", "#e8dfd0", "#ffffff", "#000000"];

/** Null means invalid. Empty text means use the current Herdr theme. */
export function parseMessageColor(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const hex = text.replace(/^#/, "");
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  return "#" + (hex.length <= 4 ? [...hex].map(c => c + c).join("") : hex).toLowerCase();
}

export function loadMessageColors() {
  const saved = shared(KEY), colors = {};
  for (const field of COLOR_FIELDS) {
    const color = parseMessageColor(saved?.[field]);
    if (color) colors[field] = color;
  }
  return colors;
}

export function saveMessageColor(field, value) {
  if (!COLOR_FIELDS.includes(field)) return false;
  const color = parseMessageColor(value);
  if (color === null) return false;
  const colors = loadMessageColors();
  if (color) colors[field] = color;
  else delete colors[field];
  remember(KEY, colors);
  return true;
}

export function resetMessageColors() { remember(KEY, {}); }

/** Custom backgrounds follow Wallpaper's opacity, as the default bubbles do. */
export function messageColors(t, translucent = true) {
  const saved = loadMessageColors();
  const opacity = translucent ? seeThroughOpacity() : null;
  const background = (field, fallback) => {
    const color = saved[field];
    if (!color) return fallback;
    if (opacity === null) return color;
    const alpha = color.length === 9 ? parseInt(color.slice(7), 16) : 255;
    return color.slice(0, 7) + Math.round(alpha * opacity).toString(16).padStart(2, "0");
  };
  // A custom background with no text color of its own gets light or dark text to suit it, so it
  // stays readable when the Herdr theme changes between light and dark.
  const text = (field, backgroundField, fallback) => saved[field] ?? (saved[backgroundField] ? readableOn(saved[backgroundField]) : fallback);
  return { userBackground: background("userBackground", t.accent), userText: text("userText", "userBackground", t.accent_foreground),
    agentBackground: background("agentBackground", t.raised), agentText: text("agentText", "agentBackground", t.foreground) };
}

/** Near-black on a light color, white on a dark one. @param {string} color "#rrggbb" or "#rrggbbaa" */
export function readableOn(color) {
  const [r, g, b] = [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16) / 255);
  // Perceived brightness (ITU-R BT.601 weights), as the kit's inkOn.
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? "#16161a" : "#ffffff";
}
