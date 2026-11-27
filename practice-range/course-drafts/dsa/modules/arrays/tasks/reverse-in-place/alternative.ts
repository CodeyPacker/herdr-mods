function reverseInPlace(values: number[]): void {
  const half = Math.floor(values.length / 2);
  for (let index = 0; index < half; index++) {
    const mirror = values.length - 1 - index;
    [values[index], values[mirror]] = [values[mirror], values[index]];
  }
}
