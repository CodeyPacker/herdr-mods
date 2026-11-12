// Tourist's own building blocks, made from the shared kit (kit/).
import { letterRow } from "./kit/letters.js";
import { rowText } from "./kit/list.js";
import { keyButton } from "./kit/controls.js";

/** A pickable row: key letter, label and a dim hint under it. Long text wraps. `click` gets (event, cx). */
export function option(t, id, letter, label, hint, on, click) {
  return letterRow(t, { id, letters: letter, typed: "", on, tall: true, click: cx => click(null, cx) })
    .child(rowText(t, label, hint, true));
}

/** A small button with its key shown first. Dim and inert when not enabled. `click` gets (event, cx). */
export function button(t, id, label, keyHint, enabled, click) {
  return keyButton(t, id, keyHint, label, enabled, cx => click(null, cx));
}
