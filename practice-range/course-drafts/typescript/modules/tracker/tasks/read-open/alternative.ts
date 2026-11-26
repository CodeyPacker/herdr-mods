import { isTask } from "./model.js";
export async function openIds(read: () => Promise<unknown>): Promise<string[]> { const value = await read(); const ids: string[] = []; if(Array.isArray(value)) for(const row of value) if(isTask(row) && !row.done) ids.push(row.id); return ids; }
