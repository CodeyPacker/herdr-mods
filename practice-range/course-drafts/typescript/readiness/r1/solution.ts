function finalCount(start: number, changes: number[]): number {
  let total = start;
  for (const change of changes) {
    if (change >= 0) total += change;
  }
  return total;
}
