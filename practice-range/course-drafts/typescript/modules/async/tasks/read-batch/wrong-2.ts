async function loadBatch(source: () => Promise<string[]>): Promise<Batch> {
  try {return {kind:"loaded",items:await source()};} catch {return {kind:"loaded",items:[]};}
}
