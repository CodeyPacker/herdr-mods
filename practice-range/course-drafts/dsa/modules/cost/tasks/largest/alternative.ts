function largest(values: number[]): number {
  let best = values[0];
  for (let index = 1; index < values.length; index++) {
    if (values[index] > best) best = values[index];
  }
  return best;
}
