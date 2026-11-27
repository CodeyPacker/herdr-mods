function indexOfSorted(values: number[], target: number): number {
  function search(low: number, high: number): number {
    if (low > high) return -1;
    const middle = Math.floor((low + high) / 2);
    const found = values[middle];
    if (found === target) return middle;
    return found < target ? search(middle + 1, high) : search(low, middle - 1);
  }
  return search(0, values.length - 1);
}
