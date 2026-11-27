function minMax(values: number[]): number[] {
  if (values.length === 0) return [0, 0];
  return [Math.min(...values), Math.max(...values)];
}
