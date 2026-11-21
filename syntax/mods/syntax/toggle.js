// Practice Range as a full-window dialog or a tab, toggled by one key (`mod.open:syntax`, see main.js).
// The key opens a tiny overlay that calls togglePractice and closes. The dialog is a layout:
// Practice Range on the left and, when Neovim is your editor, a live Neovim terminal on the right.
// That terminal runs in herdr-core, so it keeps running while the dialog is closed, and the
// next open shows it again. Practice Range saves where you were as it closes (see main.js).
import { openOverlay, closeOverlay, shared, setShared, terminals, exec, appHome } from "herdr";
import { configuredEditor } from "./bridge.js";
import { opensAsTab, toggleTab } from "./kit/open-as.js";

/** The open dialog's overlay id, or null. Practice Range clears it as it closes. */
export const DIALOG_KEY = "syntax.dialog";
/** The Neovim beside the dialog: `{ terminal, server }`. */
export const EDITOR_KEY = "syntax.editor";

/** The Neovim terminal, when it is still running. @returns {{ terminal: string, server: string } | null} */
export function liveEditor() {
  const editor = /** @type {{ terminal: string, server: string } | null} */ (shared(EDITOR_KEY));
  if (!editor) return null;
  return terminals().some(t => t.address === editor.terminal && t.state === "live") ? editor : null;
}

/** Starts Neovim in a terminal without a tab, listening for files to open. */
async function startEditor() {
  const server = `127.0.0.1:${19000 + Math.floor(Math.random() * 30000)}`;
  const result = await exec("hc", ["run", "--bg", "--json", "--no-parent", "--name", `practice-nvim-${Date.now() % 100000}`, "--cwd", appHome(), "nvim", "--listen", server]);
  if (result.code !== 0) throw new Error(result.stderr || "Could not start Neovim.");
  const editor = { terminal: JSON.parse(result.stdout).address, server };
  setShared(EDITOR_KEY, editor);
  return editor;
}

/** Opens the dialog, with Neovim beside it when Neovim is the chosen editor. */
export async function openPractice() {
  let editor = null;
  if (await configuredEditor() === "neovim") editor = liveEditor() ?? await startEditor();
  /** @type {any[]} */
  const children = [{ id: "practice-range", type: "block", content: { mod: "syntax", props: { dialog: true } }, size: { weight: 1 } }];
  if (editor) children.push({ id: "practice-editor", type: "block", content: { terminal: editor.terminal }, size: { weight: 1 } });
  const id = openOverlay({ layout: { id: "practice-root", type: "row", children }, kind: "dialog", width: 1, height: 1, modal: true });
  setShared(DIALOG_KEY, id);
}

/**
 * Closes the dialog when it is open, else opens it. Set to open as a tab in the settings: goes to
 * the Practice Range tab, or from it back to the tab you came from (kit/open-as.js).
 */
export async function togglePractice() {
  // An open dialog closes first, even when the setting changed to a tab while it was open.
  const open = shared(DIALOG_KEY);
  if (typeof open === "string") { setShared(DIALOG_KEY, null); closeOverlay(open); return; }
  if (opensAsTab("syntax")) { toggleTab("syntax", "Practice Range", { practiceTab: true }); return; }
  await openPractice();
}

/**
 * Opens the dialog again, so a Neovim that was not running gets its place beside it. The new
 * dialog opens first: closing the old one ends the copy that asked for this.
 */
export async function reopenPractice() {
  const old = shared(DIALOG_KEY);
  await openPractice();
  if (typeof old === "string") closeOverlay(old);
}
