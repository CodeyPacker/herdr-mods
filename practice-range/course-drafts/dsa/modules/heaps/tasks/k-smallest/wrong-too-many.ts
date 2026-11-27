function kSmallest(values: number[], k: number): number[] {
  const heap: number[] = [];
  for (const value of values) heapAdd(heap, value);
  const smallest: number[] = [];
  for (let count = 0; count < k; count++) smallest.push(heapTake(heap)!);
  return smallest;
}
