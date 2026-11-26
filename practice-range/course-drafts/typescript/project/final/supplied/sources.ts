import type { ReadBatch } from "./contract.js";

export function localBatch(value: unknown): ReadBatch {
  return async () => value;
}

export function unavailable(): ReadBatch {
  return async () => { throw new Error("Local snapshot unavailable"); };
}
