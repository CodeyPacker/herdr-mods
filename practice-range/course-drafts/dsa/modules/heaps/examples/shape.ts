//        1
//      /   \
//     3     2
//    / \   /
//   7   4 5
const heap = [1, 3, 2, 7, 4, 5];
const parent = (index: number): number => Math.floor((index - 1) / 2);

for (let index = 1; index < heap.length; index++) {
  console.log(heap[index], "has parent", heap[parent(index)]);
}
