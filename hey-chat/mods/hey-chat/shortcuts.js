// The keys you can change in Settings, and how a key is written on screen ("ctrl-g" as "⌃g").
// The kit's Shortcuts keeps which key each one is on, which are turned off, and whether key
// hints show, in Herdr's shared state so every chat tab has the same keys.
import { shared } from "herdr";
import { Shortcuts } from "./kit/shortcuts.js";
import { sharedStorage } from "./kit/open-as.js";

/** Whether key hints showed, from before the kit kept it. Read once, as the default. */
const OLD_KEY_HINTS = "hey-chat.keyHints";

/**
 * Each shortcut: `id` is saved, so keep it. `key` is the keystroke it starts with. `fixed`: it
 * can be turned off but not moved. Where a key works is in `what` and keys.js.
 * @type {import("./kit/shortcuts.js").Shortcut[]}
 */
export const KEYS = [
  { id: "settings", key: "ctrl-,", what: "Open or close Settings", fixed: true },
  { id: "tree", key: "ctrl-h", what: "Go to the sidebar" },
  { id: "chat", key: "ctrl-l", what: "Go to the message box" },
  { id: "scrollDown", key: "ctrl-j", what: "Scroll the chat down" },
  { id: "scrollUp", key: "ctrl-k", what: "Scroll the chat up" },
  { id: "sidebar", key: "ctrl-b", what: "Hide or show the sidebar" },
  { id: "stop", key: "ctrl-c", what: "Stop the agent's turn" },
  { id: "jump", key: "ctrl-g", what: "Open the chat that just finished" },
  { id: "last", key: "ctrl-o", what: "Switch to the last chat" },
  { id: "projects", key: "ctrl-p", what: "Jump to another project's chat tab" },
  { id: "allow", key: "y", what: "Permission: allow once" },
  { id: "always", key: "a", what: "Permission: always allow" },
  { id: "deny", key: "n", what: "Permission: deny" },
  { id: "select", key: "v", what: "Sidebar: select several chats" },
  { id: "delete", key: "d", what: "Sidebar: delete" },
  { id: "newChat", key: "n", what: "Sidebar: new chat" },
  { id: "openProject", key: "shift-n", what: "Sidebar: open a project" },
];

/** The view's shortcuts. `onChange` runs when a key or an option changes. @param {(id: string, on: boolean) => void} [onChange] */
export function makeShortcuts(onChange) {
  return new Shortcuts({
    mod: "hey-chat", keys: KEYS, rebind: true, openKey: "ctrl-,", storage: sharedStorage("hey-chat"),
    hints: shared(OLD_KEY_HINTS) !== false, onChange,
  });
}

/** How modifier keys are written. */
const MODIFIERS = { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘", platform: "⌘", fn: "fn " };
/** How some keys are written. */
const NAMES = { escape: "esc", enter: "↵", up: "↑", down: "↓", left: "←", right: "→", backspace: "⌫", space: "space", tab: "tab" };

/** A keystroke as the screen shows it: "ctrl-g" as "⌃g", "shift-n" as "N". "" stays "". @param {string} keystroke */
export function keyLabel(keystroke) {
  if (!keystroke) return "";
  const parts = keystroke.split("-");
  // "ctrl--" is ctrl with the minus key.
  const key = parts.at(-1) === "" ? "-" : parts.at(-1) ?? "";
  const mods = parts.slice(0, parts.at(-1) === "" ? -2 : -1);
  if (mods.length === 1 && mods[0] === "shift" && /^[a-z]$/.test(key)) return key.toUpperCase();
  return mods.map((m) => MODIFIERS[/** @type {keyof MODIFIERS} */ (m)] ?? `${m}-`).join("") + (NAMES[/** @type {keyof NAMES} */ (key)] ?? key);
}
