import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme, shared, props, run, layout } from "herdr";

// Rough width of 11.8 px Geist text, measured from screenshots. A bit generous so nothing clips.
const CHAR_PX = 6.1;

// The islands' fill at the opacity in islands-workspace-chrome/settings.json (1 when unset).
// Over a background picture with see-through terminals, at the terminals' opacity instead.
const islandFill = (c) => {
  const o = wallpaperOpacity() ?? shared("islands.opacity");
  if (typeof o !== "number" || o >= 1 || !/^#[0-9a-f]{6}$/i.test(c)) return c;
  return c + Math.round(Math.max(0, o) * 255).toString(16).padStart(2, "0");
};

// The panes' opacity when the background picker made them see-through on the shown layout: it
// records { layout, opacity } in shared state, clears the terminals and gives the pane frame the
// theme's background at that opacity. Null otherwise, so other setups look as they always have.
// Same as seeThroughOpacity in the mods' kit/theme.js.
// The opacity the Wallpaper mod recorded for the shown layout, 1 (solid) included, so its 100%
// wins over islands.opacity. Null when it recorded none for this layout.
function wallpaperOpacity() {
  const s = shared("backgrounds.seeThrough");
  if (!s || typeof s !== "object" || s.layout !== shared("layout")) return null;
  const o = Number(s.opacity);
  return Number.isFinite(o) ? Math.min(1, Math.max(0, o)) : null;
}

function seeThroughOpacity() {
  const s = shared("backgrounds.seeThrough");
  if (!s || typeof s !== "object" || s.layout !== shared("layout")) return null;
  const root = layout();
  if (!root || typeof root.background !== "object" || typeof root.background?.image !== "string") return null;
  const o = Number(s.opacity);
  return Number.isFinite(o) && o < 1 ? Math.max(0, o) : null;
}

export default class WorkspaceStatus extends View {
  render() {
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = agents();
    const needs = list.filter(a => a.status === "blocked").length;
    // props.fit: "<node id>" resizes that layout node to this card's content width.
    const fit = props()?.fit;
    if (fit) {
      const texts = [space?.machine ?? "This computer", space?.branch, `${list.length} agents`, needs > 0 && `· ${needs} needs you`].filter(Boolean);
      const chars = texts.reduce((n, s) => n + s.length, 0);
      // padding 28, border 2, icons 19 each, dot 12, gaps 16 between items and 6 before "needs you".
      const px = Math.ceil(30 + 19 * (space?.branch ? 2 : 1) + 12 + 16 * (space?.branch ? 2 : 1) + (needs > 0 ? 6 : 0) + chars * CHAR_PX);
      if (px !== this.fitPx) { this.fitPx = px; run("layout.resize", { id: fit, px }); }
    }
    const label = (icon, text, color) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13).text_color(color)).child(text); // colored icon, muted text
    return h_flex().size_full().px(14).gap(16).items_center().rounded(13).overflow_hidden().bg(islandFill(t.chrome)).text_size(11.8).text_color(t.muted) // its own card, no divider
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer", t.working))
      .when(Boolean(space?.branch), el => el.child(label("branch", space.branch, t.accent)))
      .child(h_flex().gap(6).items_center().child(div().size(6).rounded(3).bg(needs > 0 ? t.blocked : list.length > 0 ? t.done : t.dim)).child(`${list.length} agents`)
        .when(needs > 0, el => el.child(div().text_color(t.blocked).child(`· ${needs} needs you`))));
  }
}
