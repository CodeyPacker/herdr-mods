import type { Audit } from "./contract.js";
export const audit: Audit = async (read) => {
 let input: unknown;
 try { input = await read(); } catch { return {kind:"unavailable"}; }
 if (!Array.isArray(input)) return {kind:"invalid-batch"};
 const seen = new Set<string>();
 let open=0, done=0, rejected=0, duplicates=0;
 for (const row of input) {
  if (typeof row !== "object" || row === null || Array.isArray(row) || !("id" in row) || typeof row.id !== "string" || row.id.length===0 || !("done" in row) || typeof row.done !== "boolean") { rejected++; continue; }
  if (seen.has(row.id)) { duplicates++; continue; }
  seen.add(row.id);
  done += Number(row.done); open += Number(!row.done);
 }
 return {kind:"report",open,done,rejected,duplicates};
};
