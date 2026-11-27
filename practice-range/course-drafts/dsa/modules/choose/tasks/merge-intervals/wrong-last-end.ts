function mergeIntervals(intervals: [number, number][]): [number, number][] {
  const sorted = [...intervals].sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && start <= last[1]) last[1] = end;
    else merged.push([start, end]);
  }
  return merged;
}
