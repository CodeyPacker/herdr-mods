function countAbove(values: number[], limit: number): number {
  let count = 0;
  for (const value of values) {
    if (value > limit) count += value;
  }
  return count;
}
