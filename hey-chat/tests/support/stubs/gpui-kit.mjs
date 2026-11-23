// Stands in for Herdr's "gpui-kit" module: the view base class and element builders.
import { element } from '../elements.mjs';

export const View = class {};
export const div = () => element();
export const svg = () => element();
export const image = () => element();
