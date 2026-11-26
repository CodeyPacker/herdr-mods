import { Board } from "./board.js";
export function countOpen(board: Board): number { let count = 0; for (const task of board.all()) if (!task.done) count++; return count; }
