function reverseInPlace(values: number[]): void {
  for (let index = 0; index < values.length; index++) {
    const mirror = values.length - 1 - index;
    const held = values[index];
    values[index] = values[mirror];
    values[mirror] = held;
  }
}
