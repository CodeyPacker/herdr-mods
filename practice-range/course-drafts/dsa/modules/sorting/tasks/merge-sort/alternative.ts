function mergeSort(values: number[]): number[] {
  let sorted = [...values];
  for (let width = 1; width < sorted.length; width *= 2) {
    const next: number[] = [];
    for (let start = 0; start < sorted.length; start += 2 * width) {
      const middle = Math.min(start + width, sorted.length);
      const end = Math.min(start + 2 * width, sorted.length);
      let i = start;
      let j = middle;
      while (i < middle || j < end) {
        const takeRight = i >= middle || (j < end && before(sorted[j], sorted[i]));
        next.push(takeRight ? sorted[j++] : sorted[i++]);
      }
    }
    sorted = next;
  }
  return sorted;
}
