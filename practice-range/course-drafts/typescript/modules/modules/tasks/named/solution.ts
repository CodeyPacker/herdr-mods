import { starting, add } from "./numbers.js";
export function next(delta: number): number {
  return add(starting, delta);
}
