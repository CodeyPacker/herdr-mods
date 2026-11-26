import { Board } from "./board.js";
export function countOpen(board: Board): number { return board.all().filter(task => !task.done).length; }
