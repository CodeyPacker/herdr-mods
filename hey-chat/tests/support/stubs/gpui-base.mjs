// Stands in for Herdr's "gpui-base" module: layout builders, text boxes and scroll handles.
import { element } from '../elements.mjs';

/** A text box's state: its text, and handlers that are kept but never called. */
function textState(options = {}) {
  let value = options.value ?? '';
  return {
    value: () => value,
    set_value: (next) => { value = next; },
    on() {}, focus() {}, release() {}, replace() {}, set_auto_grow() {},
    selected_range: () => ({ start: value.length, end: value.length }),
    set_selected_range() {},
  };
}

const builder = { new: () => element() };

export const h_flex = () => element();
export const v_flex = () => element();
export const Input = builder;
export const Textarea = builder;
export const TextView = { html: () => element(), markdown: () => element() };
export const InputState = { new: textState };
export const TextareaState = { new: textState };
export const ScrollHandle = { new: () => ({ scroll_to_item() {}, release() {} }) };
export const Slider = () => element();
export const SliderTrack = () => element();
export const SliderIndicator = () => element();
export const SliderThumb = () => element();
export const SliderState = { new: () => ({}) };
