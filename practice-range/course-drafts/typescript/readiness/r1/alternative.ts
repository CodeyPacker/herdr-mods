function finalCount(start: number, changes: number[]): number {
  return changes.filter(change => change >= 0).reduce((sum, change) => sum + change, start);
}
