function peakHour(counts: number[]): number {
  if (counts.length === 0) return -1;
  return Math.max(...counts);
}
