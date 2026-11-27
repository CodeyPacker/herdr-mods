function sqrtFloor(n: number): number {
  let low = 0;
  let high = n;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (middle * middle < n) low = middle + 1;
    else high = middle;
  }
  return low;
}
