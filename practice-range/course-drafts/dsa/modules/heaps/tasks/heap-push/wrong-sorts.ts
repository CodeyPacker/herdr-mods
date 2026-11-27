function heapPush(heap: number[], value: number): void {
  heap.push(value);
  heap.sort((a, b) => a - b);
}
