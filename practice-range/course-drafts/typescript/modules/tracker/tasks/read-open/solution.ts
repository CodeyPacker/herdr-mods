import { isTask } from "./model.js";
export async function openIds(read: () => Promise<unknown>): Promise<string[]> { const value = await read(); return Array.isArray(value) ? value.filter(isTask).filter(task => !task.done).map(task => task.id) : []; }
