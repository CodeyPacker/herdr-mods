async function loadBatch(source: () => Promise<string[]>): Promise<Batch> {
  try { await source(); return {kind:"loaded",items:[]}; } catch {return {kind:"failed"};}
}
