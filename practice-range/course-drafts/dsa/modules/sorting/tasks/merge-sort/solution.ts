function mergeSort(values: number[]): number[] {
  if (values.length <= 1) return [...values];
  const middle = Math.floor(values.length / 2);
  const left = mergeSort(values.slice(0, middle));
  const right = mergeSort(values.slice(middle));
  const merged: number[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (before(right[j], left[i])) merged.push(right[j++]);
    else merged.push(left[i++]);
  }
  while (i < left.length) merged.push(left[i++]);
  while (j < right.length) merged.push(right[j++]);
  return merged;
}
