import { isTask, type Task } from "./model.js";
export function rows(value: unknown): Task[] { const tasks: Task[] = []; if (Array.isArray(value)) for (const item of value) if (isTask(item)) tasks.push(item); return tasks; }
