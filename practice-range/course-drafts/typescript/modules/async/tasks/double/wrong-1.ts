async function doubled(source: () => Promise<number>): Promise<number> {
  return source();
}
