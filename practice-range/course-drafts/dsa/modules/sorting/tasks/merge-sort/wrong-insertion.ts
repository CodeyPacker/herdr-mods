function mergeSort(values: number[]): number[] {
  const sorted = [...values];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    let j = i - 1;
    while (j >= 0 && before(current, sorted[j])) {
      sorted[j + 1] = sorted[j];
      j--;
    }
    sorted[j + 1] = current;
  }
  return sorted;
}
