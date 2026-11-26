function uniqueStops(stops: string[]): string[] {
  return [...new Set(stops)].sort();
}
