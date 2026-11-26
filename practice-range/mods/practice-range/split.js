// Shapes the tab's split between the panel and Neovim to the saved layout. Herdr moves a border
// by a number of pixels (pane.resize), so the width change is worked out from the panel's own
// width and the share it had before. Pure: main.js runs the commands (bridge.js appCommands).

/**
 * @typedef {object} Arrangement
 * @property {string} panel the panel's pane
 * @property {string} editor Neovim's pane
 * @property {"left" | "right"} from where the panel is now
 * @property {"left" | "right"} side where it should be
 * @property {number} share the panel's share of the tab now, 0 to 1
 * @property {number} width the share it should have
 * @property {number} total the tab's width in px, panel and editor together
 */

/** Below this many px a resize isn't worth a redraw. */
const MIN_STEP = 2;

/**
 * The app commands that move the panel to its side and give it its width. A swap keeps each
 * pane's width, so the resize comes after it. The left pane is always the one resized: its only
 * border is on its right, so "right" always grows it and "left" always shrinks it.
 * @param {Arrangement} a @returns {{ command: string, args: Record<string, unknown> }[]}
 */
export function arrangeCommands(a) {
  /** @type {{ command: string, args: Record<string, unknown> }[]} */
  const commands = [];
  if (a.from !== a.side) commands.push({ command: "pane.swap", args: { pane: a.panel, target: a.editor } });
  // After a swap, the panel keeps its old width on the new side.
  const grow = Math.round((a.width - a.share) * a.total);
  if (Math.abs(grow) < MIN_STEP) return commands;
  const left = a.side === "left" ? a.panel : a.editor;
  // Growing the panel on the right means shrinking the pane on its left.
  const leftGrows = a.side === "left" ? grow > 0 : grow < 0;
  commands.push({ command: "pane.resize", args: { pane: left, direction: leftGrows ? "right" : "left", px: Math.abs(grow) } });
  return commands;
}
