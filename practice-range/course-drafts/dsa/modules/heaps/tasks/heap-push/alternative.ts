function heapPush(heap: number[], value: number): void {
  let index = heap.length;
  heap.push(value);
  while (index > 0 && heap[Math.floor((index - 1) / 2)] > value) {
    const parent = Math.floor((index - 1) / 2);
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = value;
}
