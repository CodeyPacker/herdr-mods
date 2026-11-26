async function doubled(source: () => Promise<number>): Promise<number> {
  return 2 * source();
}
