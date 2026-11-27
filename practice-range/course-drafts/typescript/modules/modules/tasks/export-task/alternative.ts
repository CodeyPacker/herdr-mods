import type { Song as Item } from "./model.js";
export const makeSong = (id: number, title: string): Item => ({ id, title });
