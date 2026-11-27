const heap = [1, 3, 2, 7, 4, 5];
heap.push(0);
let index = heap.length - 1;
while (index > 0) {
  const parent = Math.floor((index - 1) / 2);
  if (heap[parent] <= heap[index]) break;
  const held = heap[parent];
  heap[parent] = heap[index];
  heap[index] = held;
  index = parent;
  console.log(heap.join(" "));
}
