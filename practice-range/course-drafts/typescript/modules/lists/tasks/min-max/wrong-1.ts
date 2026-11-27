function minMax(values: number[]): [number, number] {
  let low = 0;
  let high = 0;
  for (const value of values) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  return [low, high];
}
