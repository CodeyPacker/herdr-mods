function finalCount(start: number, changes: number[]): number {
  let total = start;
  for (const change of changes) total += change;
  return total;
}
