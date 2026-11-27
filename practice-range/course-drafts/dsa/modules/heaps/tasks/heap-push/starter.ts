function heapPush(heap: number[], value: number): void {
  heap.push(value);
  const index = heap.length - 1;
  const parent = Math.floor((index - 1) / 2);
  if (index > 0 && heap[parent] > heap[index]) {
    const held = heap[parent];
    heap[parent] = heap[index];
    heap[index] = held;
  }
}
