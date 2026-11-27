function mergeSorted(a: number[], b: number[]): number[] {
  return [...a, ...b].sort((x, y) => x - y);
}
