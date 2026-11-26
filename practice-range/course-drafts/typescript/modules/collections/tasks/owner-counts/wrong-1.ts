function ownerCounts(owners: string[]): Map<string, number> {
  return new Map(owners.map(k => [k, 1]));
}
