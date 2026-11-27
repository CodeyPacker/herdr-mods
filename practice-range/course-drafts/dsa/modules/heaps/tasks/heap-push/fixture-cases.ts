/** True when every parent is less than or equal to its children. */
function __isHeap(heap: number[]): boolean {
  for (let index = 1; index < heap.length; index++) {
    if (heap[Math.floor((index - 1) / 2)] > heap[index]) return false;
  }
  return true;
}
function __afterPush(heap: number[], value: number): number[] {
  heapPush(heap, value);
  return heap;
}
