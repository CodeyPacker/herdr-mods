function ownerCounts(owners: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of owners) {
    const prior = counts.get(name);
    counts.set(name, prior === undefined ? 1 : prior + 1);
  }
  return counts;
}
