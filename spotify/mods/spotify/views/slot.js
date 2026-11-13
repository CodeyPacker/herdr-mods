// What the now-playing slot draws: the small bar, and the card (views/card.js) while slot.cardOpen.
import { div, image } from "gpui-kit";
import { h_flex, Popup } from "gpui-base";
import { cardView } from "./card.js";

/** @typedef {import("gpui-kit").Context} Context */
/** @typedef {import("../kit/theme.js").Theme} Theme */
/** @typedef {import("../player.js").Playback} Playback */
/** @typedef {import("../slot.js").Slot} Slot */
/**
 * What the slot's controls call back into.
 * @typedef {{ open: () => void, hover: (region: string, on: boolean, cx: Context) => void, resize: (width: number, cx: Context) => void }} SlotHandlers
 */

const ART_SIZE = 18;
const PAD = 10;

/** The words shown when there is no track. @param {Playback} p */
export function restingText(p) {
  if (p.kind === "signed-out") return "Sign in to Spotify";
  if (p.kind === "idle") return "Nothing playing";
  if (p.kind === "error") return "Spotify unavailable";
  return "Spotify";
}

/** @param {Slot} slot @param {Theme} t @param {SlotHandlers} on */
export function slotView(slot, t, on) {
  const now = slot.now;
  const p = now.playback;
  const root = h_flex().id("sp-slot").size_full().px(PAD).items_center().rounded(13).overflow_hidden()
    .bg(t.chrome).text_size(11.8)
    .on_size_change((size, cx) => on.resize(size.width, cx));
  // The bar's content is as wide as the slot, so the title is cut to fit and a click anywhere opens the dialog.
  const content = h_flex().id("sp-slot-content").gap(8).items_center().cursor_pointer()
    .when(slot.width > 0, (el) => el.w(slot.width - PAD * 2))
    .on_click(() => on.open());
  if (p.kind !== "track") {
    return root.child(content.text_color(t.dim)
      .child(div().flex_none().child("♪"))
      .child(div().flex_1().min_w(0).truncate().child(restingText(p))));
  }
  const picture = now.art.small
    ? image(now.art.small).size(ART_SIZE).rounded(3).flex_none()
    : div().size(ART_SIZE).flex_none().rounded(3).bg(t.raised).flex().items_center().justify_center().text_size(10).text_color(t.dim).child("♪");
  // Paused music keeps its title but goes dim.
  content
    .on_hover((hovered, cx) => on.hover("slot", hovered, cx))
    .child(picture)
    .child(div().flex_1().min_w(0).truncate().text_color(p.playing ? t.foreground : t.dim)
      .child(p.artist ? `${p.title} · ${p.artist}` : p.title));
  // A Popup, not a HoverCard: a HoverCard closes itself when a slider inside it is dragged,
  // so the slot keeps the open state (slot.cardOpen) and decides when the card closes.
  // The anchor names the card's corner that is pinned to the slot: its top right corner puts
  // the card below the slot, its bottom right corner puts it above (for a slot in a bottom bar).
  return root.child(Popup.new("sp-card", content).anchor(slot.cardAbove ? "bottom_right" : "top_right")
    .when(slot.cardOpen, (el) => el.content(cardView(now, p, t, (region) => (hovered, cx) => on.hover(region, hovered, cx)))));
}
