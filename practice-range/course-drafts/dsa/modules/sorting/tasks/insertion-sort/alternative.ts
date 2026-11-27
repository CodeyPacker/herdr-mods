function insertionSort(values: number[]): number[] {
  for (let i = 1; i < values.length; i++) {
    for (let j = i; j > 0 && values[j - 1] > values[j]; j--) {
      [values[j - 1], values[j]] = [values[j], values[j - 1]];
    }
  }
  return values;
}
