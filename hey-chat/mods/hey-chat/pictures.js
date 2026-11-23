// Profile pictures: Claude's, Codex's and yours, as round elements of any size.
import { div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { ICONS } from "./common.js";

/** @typedef {import("./kit/theme.js").Theme} Theme */

/** Each agent's name, circle color and mark. The marks are drawn white on the circle. */
export const AGENTS = {
  claude: { name: "Claude", fill: "#D97757", ring: null, mark: `${ICONS}/claude.svg` },
  // Codex's own mark, not OpenAI's logo: a dark circle with a faint ring and a prompt.
  codex: { name: "Codex", fill: "#111318", ring: "#ffffff2e", mark: `${ICONS}/codex.svg` },
};

/** An agent's picture, `size` px across. @param {string} agent @param {number} size */
export function agentPicture(agent, size) {
  const a = AGENTS[agent] ?? AGENTS.claude;
  return h_flex().flex_none().size(size).rounded_full().items_center().justify_center().bg(a.fill)
    .when(Boolean(a.ring), (el) => el.border_1().border_color(a.ring))
    .child(svg(a.mark).size(Math.round(size * 0.58)).text_color("#ffffff"));
}

/**
 * Your picture, `size` px across: your uploaded photo, else initials on a color.
 * @param {import("./me.js").Me} me @param {number} size
 */
export function myPicture(me, size) {
  const el = h_flex().flex_none().size(size).rounded_full().overflow_hidden().items_center().justify_center();
  // The image is rounded itself: the round frame around it doesn't clip its corners.
  if (me.picture) return el.child(image(me.picture).size(size).rounded_full());
  return el.bg(me.color)
    .child(div().text_size(Math.round(size * 0.38)).font_semibold().text_color("#ffffff").child(me.initials));
}

/**
 * A picture with a status dot on its bottom-right edge, ringed in the pane's color.
 * @param {any} picture @param {number} size @param {string} dot @param {string} ring
 */
export function withDot(picture, size, dot, ring) {
  const d = Math.max(10, Math.round(size * 0.28));
  return div().relative().flex_none().size(size).child(picture)
    .child(div().absolute().right(-1).bottom(-1).size(d).rounded_full().bg(dot).border_2().border_color(ring));
}
