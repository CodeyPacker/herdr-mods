async function doubled(source: () => Promise<number>): Promise<number> {
  const n = await source();
  return 2 * n;
}
