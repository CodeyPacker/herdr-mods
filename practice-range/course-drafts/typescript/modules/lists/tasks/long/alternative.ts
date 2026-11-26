function longTasks(values: number[], minimum: number): number[] {
  const kept: number[] = [];
  for (const value of values) {
    if (minimum <= value) kept.push(value);
  }
  return kept;
}
