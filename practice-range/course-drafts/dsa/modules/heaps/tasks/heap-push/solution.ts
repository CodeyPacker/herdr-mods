function heapPush(heap: number[], value: number): void {
  heap.push(value);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent] <= heap[index]) break;
    const held = heap[parent];
    heap[parent] = heap[index];
    heap[index] = held;
    index = parent;
  }
}
