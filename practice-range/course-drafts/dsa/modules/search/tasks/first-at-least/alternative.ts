function firstAtLeast(values: number[], target: number): number {
  let low = 0;
  let high = values.length - 1;
  let answer = values.length;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] >= target) {
      answer = middle;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }
  return answer;
}
