function subsets(items: string[]): string[][] {
  if (items.length === 0) return [];
  const [first, ...rest] = items;
  const without = subsets(rest);
  const withFirst = without.map(subset => [first, ...subset]);
  return [...without, ...withFirst];
}
