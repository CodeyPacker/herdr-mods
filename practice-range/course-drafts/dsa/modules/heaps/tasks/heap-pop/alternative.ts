function heapPop(heap: number[]): number | undefined {
  function siftDown(index: number): void {
    const left = 2 * index + 1;
    const right = left + 1;
    let smallest = index;
    if (left < heap.length && heap[left] < heap[smallest]) smallest = left;
    if (right < heap.length && heap[right] < heap[smallest]) smallest = right;
    if (smallest === index) return;
    [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
    siftDown(smallest);
  }
  const top = heap[0];
  const last = heap.pop();
  if (last !== undefined && heap.length > 0) {
    heap[0] = last;
    siftDown(0);
  }
  return top;
}
