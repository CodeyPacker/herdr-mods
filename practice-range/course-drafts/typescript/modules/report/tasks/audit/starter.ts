import type { Audit } from "./contract.js";

export const audit: Audit = async (_read) => {
  return { kind: "unavailable" };
};
