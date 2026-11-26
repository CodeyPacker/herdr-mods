function finalCount(start: number, changes: number[]): number {
  let total = 0;
  for (const change of changes) {
    if (change >= 0) total += change;
  }
  return total;
}
