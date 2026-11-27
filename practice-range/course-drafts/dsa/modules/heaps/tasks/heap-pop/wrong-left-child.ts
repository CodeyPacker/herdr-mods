function heapPop(heap: number[]): number | undefined {
  if (heap.length === 0) return undefined;
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length === 0) return top;
  heap[0] = last;
  let index = 0;
  while (true) {
    const left = 2 * index + 1;
    if (left >= heap.length || heap[left] >= heap[index]) break;
    const held = heap[index];
    heap[index] = heap[left];
    heap[left] = held;
    index = left;
  }
  return top;
}
