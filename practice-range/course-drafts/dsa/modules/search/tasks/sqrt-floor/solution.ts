function sqrtFloor(n: number): number {
  let low = 0;
  let high = n;
  let answer = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (middle * middle <= n) {
      answer = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return answer;
}
