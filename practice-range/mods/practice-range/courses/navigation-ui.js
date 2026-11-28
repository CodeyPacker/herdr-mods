import { keyButton as button, chip as choice } from "../kit/controls.js";
import { card as box } from "../kit/pane.js";
export * from "../kit/controls.js";

/** @type {import("../option-navigation.js").OptionNavigation | null} */
let navigation = null;
let cardsOnly = false;
/** @param {import("../option-navigation.js").OptionNavigation} value @param {string} page @param {string} [preferred] */
export function beginNavigation(value, page, preferred = "") {
  navigation = value;
  cardsOnly = page.startsWith("catalog/");
  value.begin(page, preferred);
}
/** @param {string} id @param {(cx: any) => void} click @param {boolean} [enabled] */
export function option(id, click, enabled = true) {
  return enabled && (!cardsOnly || id.startsWith("course-card-")) && Boolean(navigation?.add(id, click));
}
/** @param {string} id */
export function optionSelected(id) { return navigation?.selected === id; }
/** @type {typeof button} */
export function keyButton(t, id, key, label, enabled, click) {
  const selected = option(id, click, enabled);
  return button(t, id, key, label, enabled, click)
    .when(selected, el => el.border_2().border_color(t.accent).bg(t.selected));
}
/** @type {typeof choice} */
export function chip(t, c) {
  const selected = option(c.id, c.click);
  return choice(t, c).when(selected, el => el.border_2().border_color(t.accent));
}
/** @type {typeof box} */
export function card(t, c) {
  const selected = c.click && option(c.id, c.click);
  return box(t, { ...c, on: Boolean(selected || c.on) }).when(Boolean(selected), el => el.border_2());
}
