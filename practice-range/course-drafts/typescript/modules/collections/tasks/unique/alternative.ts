function uniqueStops(stops: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const stop of stops) {
    if (!seen.has(stop)) result.push(stop);
    seen.add(stop);
  }
  return result;
}
