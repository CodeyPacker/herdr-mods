function mergeIntervals(intervals: [number, number][]): [number, number][] {
  const sorted = [...intervals].sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  let index = 0;
  while (index < sorted.length) {
    const start = sorted[index][0];
    let end = sorted[index][1];
    index++;
    while (index < sorted.length && sorted[index][0] <= end) {
      end = Math.max(end, sorted[index][1]);
      index++;
    }
    merged.push([start, end]);
  }
  return merged;
}
