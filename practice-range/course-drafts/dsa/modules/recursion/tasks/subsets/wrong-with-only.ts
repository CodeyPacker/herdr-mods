function subsets(items: string[]): string[][] {
  if (items.length === 0) return [[]];
  const [first, ...rest] = items;
  return subsets(rest).map(subset => [first, ...subset]);
}
