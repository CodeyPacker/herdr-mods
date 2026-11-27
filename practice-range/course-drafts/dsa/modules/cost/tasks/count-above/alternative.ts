function countAbove(values: number[], limit: number): number {
  return values.filter(value => value > limit).length;
}
