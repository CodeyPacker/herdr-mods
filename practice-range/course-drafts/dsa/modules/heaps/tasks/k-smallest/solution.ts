function kSmallest(values: number[], k: number): number[] {
  const heap: number[] = [];
  for (const value of values) heapAdd(heap, value);
  const smallest: number[] = [];
  while (smallest.length < k && heap.length > 0) smallest.push(heapTake(heap)!);
  return smallest;
}
