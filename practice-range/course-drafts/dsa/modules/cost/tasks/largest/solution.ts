function largest(values: number[]): number {
  let best = values[0];
  for (const value of values) {
    if (value > best) best = value;
  }
  return best;
}
