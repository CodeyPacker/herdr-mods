function tally(items: Category[]): Record<Category, number> {
  const counts: Record<Category, number> = { fruit: 0, veg: 0, dairy: 0 };
  for (const item of items) counts[item] += 1;
  return counts;
}
