function mergeSorted(a: number[], b: number[]): number[] {
  const merged: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const takeFirst = j >= b.length || (i < a.length && a[i] <= b[j]);
    merged.push(takeFirst ? a[i++] : b[j++]);
  }
  return merged;
}
