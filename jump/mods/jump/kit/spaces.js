// Small pieces for lists of Herdr's own things: spaces, tabs, agents, processes.
import { svg } from "gpui-kit";
import { h_flex } from "gpui-base";

/** @typedef {import("herdr").SpaceInfo} SpaceInfo */
/** @typedef {import("./theme.js").Theme} Theme */
/** @typedef {import("./theme.js").Color} Color */

const SPIN = "mods/workspace-chrome/spinner.svg";

/**
 * The colored mark that shows a row's status.
 * @param {Theme} t
 * @param {string | null} status working | blocked | done | idle | running | exited | null
 */
export function statusDot(t, status) {
  const slot = () => h_flex().w(12).flex_none();
  if (status === "working") return slot().child(svg(SPIN).size(12).flex_none().text_color(t.working).spin(900));
  // Running green, dead red. Agent statuses use whatever the theme says.
  /** @type {Record<string, Color>} */
  const tone = { blocked: t.blocked, done: t.done, idle: t.idle, running: t.ansi2, exited: t.ansi1 };
  const color = tone[status ?? ""] ?? t.dim;
  const ch = status === "idle" ? "○" : status ? "●" : "·";
  return slot().text_color(color).child(ch);
}

/**
 * Tells spaces with the same name apart: the folder, plus the branch when the folders match too.
 * Empty when the name is unique.
 * @param {SpaceInfo[]} all
 * @param {SpaceInfo} s
 * @param {string} home the home folder, shown as "~"
 */
export function spaceNote(all, s, home) {
  const same = all.filter((o) => o.id !== s.id && o.name === s.name);
  if (!same.length) return "";
  const folder = s.folder.replace(home, "~");
  return same.some((o) => o.folder === s.folder) && s.branch ? `${folder} · ${s.branch}` : folder;
}
