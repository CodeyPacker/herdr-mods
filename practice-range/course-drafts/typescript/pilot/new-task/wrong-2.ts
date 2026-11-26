function peakHour(counts: number[]): number {
  let best = -1;
  for (let hour = 0; hour < counts.length; hour++) {
    if (best === -1 || counts[hour] >= counts[best]) best = hour;
  }
  return best;
}
