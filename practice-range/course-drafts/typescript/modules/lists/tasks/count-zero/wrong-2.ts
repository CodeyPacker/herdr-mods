function emptyBins(numbers: number[]): number {
  return numbers.filter(n => n <= 0).length;
}
