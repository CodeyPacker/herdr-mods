function hasDuplicate(values: number[]): boolean {
  const seen = new Set<number>();
  for (const value of values) {
    if (seen.has(value)) return true;
    seen.add(value);
  }
  return false;
}
