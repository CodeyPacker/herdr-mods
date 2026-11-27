function minMax(values: number[]): [number, number] {
  if (values.length === 0) return [0, 0];
  let low = values[0];
  let high = values[0];
  for (const value of values) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  return [low, high];
}
