async function doubled(source: () => Promise<number>): Promise<number> {
  return (await source()) * 2;
}
