function sqrtFloor(n: number): number {
  let low = 0;
  let high = n;
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (middle * middle <= n) low = middle;
    else high = middle - 1;
  }
  return low;
}
