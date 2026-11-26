import type { Task } from "./model.js";
export function rows(v: unknown): Task[] { return Array.isArray(v) ? v as Task[] : []; }
