function emptyBins(numbers: number[]): number {
  let count = 0;
  for (const value of numbers) {
    if (value === 0) count++;
  }
  return count;
}
