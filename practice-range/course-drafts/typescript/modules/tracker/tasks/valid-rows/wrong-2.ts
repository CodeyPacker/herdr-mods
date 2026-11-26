import { isTask, type Task } from "./model.js";
export function rows(v: unknown): Task[] { return Array.isArray(v) ? v.filter(isTask).slice(0,1) : []; }
