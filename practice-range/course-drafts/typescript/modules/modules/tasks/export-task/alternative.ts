import type { Task as Item } from "./model.js";
export const makeTask = (id: number, title: string): Item => ({ id, title });
