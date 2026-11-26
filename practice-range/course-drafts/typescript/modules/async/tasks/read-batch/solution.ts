async function loadBatch(source: () => Promise<string[]>): Promise<Batch> {
  try {
    const items = await source();
    return {kind:"loaded",items};
  } catch {
    return {kind:"failed"};
  }
}
