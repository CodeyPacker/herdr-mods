import { isTask } from "./model.js";
export async function openIds(read:()=>Promise<unknown>):Promise<string[]> { const v=await read(); return Array.isArray(v) ? v.filter(isTask).map(t=>t.id) : []; }
