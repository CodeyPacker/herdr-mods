/** Adds a value to a min-heap held in an array. */
function heapAdd(heap: number[], value: number): void {
  let index = heap.length;
  heap.push(value);
  while (index > 0 && heap[Math.floor((index - 1) / 2)] > value) {
    const parent = Math.floor((index - 1) / 2);
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = value;
}

/** Removes and returns the smallest value of a min-heap, or undefined when it is empty. */
function heapTake(heap: number[]): number | undefined {
  const top = heap[0];
  const last = heap.pop();
  if (last === undefined || heap.length === 0) return top;
  let index = 0;
  while (true) {
    const left = 2 * index + 1;
    const right = left + 1;
    let child = left;
    if (right < heap.length && heap[right] < heap[left]) child = right;
    if (child >= heap.length || heap[child] >= last) break;
    heap[index] = heap[child];
    index = child;
  }
  heap[index] = last;
  return top;
}
