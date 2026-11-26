function ownerCounts(owners: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const owner of owners) counts.set(owner, (counts.get(owner) ?? 0) + 1);
  return counts;
}
