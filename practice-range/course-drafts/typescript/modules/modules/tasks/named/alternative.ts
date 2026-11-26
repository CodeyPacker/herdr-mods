import * as numbers from "./numbers.js";
export function next(delta: number): number {
  return numbers.add(numbers.starting, delta);
}
