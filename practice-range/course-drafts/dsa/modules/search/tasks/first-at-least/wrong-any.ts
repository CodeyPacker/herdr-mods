function firstAtLeast(values: number[], target: number): number {
  let low = 0;
  let high = values.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const found = values[middle];
    if (found === target) return middle;
    if (found < target) low = middle + 1;
    else high = middle - 1;
  }
  return low;
}
