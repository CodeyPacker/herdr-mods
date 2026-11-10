// Zen: one key hides everything but the tabs' panes, and the same key brings it back.
// Works in any layout: it hides every part that isn't on the way from the layout's root
// to the block showing the active tab. It opens as a tiny overlay that acts and closes,
// since a mod living in the layout would hide itself and miss the next press.
import { View, div } from "gpui-kit";
import { layout, run, props, shared, setShared, closeOverlay } from "herdr";

// The path from `node` to the block showing the active tab, or null.
function pathToTabs(node) {
  if (node?.content?.tab === "active") return [node];
  for (const child of node?.children ?? []) {
    const path = pathToTabs(child);
    if (path) return [node, ...path];
  }
  return null;
}

// Every node id in the layout, so a restore never touches a different layout.
function signature(node) {
  return [node?.id, ...(node?.children ?? []).map(signature)].filter(Boolean).join(",");
}

function toggle() {
  const root = layout(), sig = signature(root);
  const saved = shared("zen");
  if (saved?.layout === sig) {
    for (const id of saved.hidden) run("layout.show", { id });
    setShared("zen", null);
    return;
  }
  const path = pathToTabs(root);
  if (!path) return;
  // Only parts that are showing now, so what was hidden before stays hidden after.
  const hidden = path.flatMap((node, i) => (node.children ?? [])
    .filter(c => c !== path[i + 1] && c.id && !c.hidden).map(c => c.id));
  for (const id of hidden) run("layout.hide", { id });
  setShared("zen", { layout: sig, hidden });
}

export default class Zen extends View {
  init() {
    // Only act when opened by the key, not when placed in a layout or loaded by `herdr-app check`.
    const overlay = props()?.overlay;
    if (!overlay) return;
    toggle();
    closeOverlay(overlay);
  }

  render() {
    return div();
  }
}
