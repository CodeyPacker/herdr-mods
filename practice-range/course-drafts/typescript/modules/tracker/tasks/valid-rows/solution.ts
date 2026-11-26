import { isTask, type Task } from "./model.js";
export function rows(value: unknown): Task[] { return Array.isArray(value) ? value.filter(isTask) : []; }
