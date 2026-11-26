async function loadBatch(source: () => Promise<string[]>): Promise<Batch> {
  return {kind:"loaded",items:[]};
}
