function atLeast(values: number[], minimum: number): number[] {
  const kept: number[] = [];
  for (const value of values) {
    if (value >= minimum) kept.push(value);
  }
  return kept;
}
