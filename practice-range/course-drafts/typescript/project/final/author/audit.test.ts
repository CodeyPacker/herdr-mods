import type { Audit } from "./contract.js";
import { localBatch } from "./sources.js";
export async function testAudit(candidate: Audit): Promise<boolean> {
 const report = await candidate(localBatch([{id:"A",done:false},{id:"A",done:true}]));
 return report.kind === "report" && report.open===1 && report.done===0 && report.duplicates===1 && report.rejected===0;
}
