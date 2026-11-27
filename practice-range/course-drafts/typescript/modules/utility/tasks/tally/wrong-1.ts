function tally(items: Category[]): Record<Category, number> {
  const counts = {} as Record<Category, number>;
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1;
  return counts;
}
