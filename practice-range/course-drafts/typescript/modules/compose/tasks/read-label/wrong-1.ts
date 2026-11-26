import { Counter } from "./counter.js";
export function label(c: Counter): string { return `${c.title}: ${c.value() || 1}`; }
