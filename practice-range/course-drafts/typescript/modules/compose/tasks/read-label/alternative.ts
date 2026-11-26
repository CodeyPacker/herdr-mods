import { Counter } from "./counter.js";
export function label(counter: Counter): string { return counter.title + ": " + String(counter.value()); }
