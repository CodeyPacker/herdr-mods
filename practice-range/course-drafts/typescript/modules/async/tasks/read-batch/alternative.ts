async function loadBatch(source: () => Promise<string[]>): Promise<Batch> {
  return source().then(items => ({kind:"loaded" as const,items}), () => ({kind:"failed" as const}));
}
