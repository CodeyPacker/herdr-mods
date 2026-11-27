const sorted = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];

function find(target: number): number {
  let low = 0;
  let high = sorted.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    console.log(low, high, sorted[middle]);
    if (sorted[middle] === target) return middle;
    if (sorted[middle] < target) low = middle + 1;
    else high = middle - 1;
  }
  return -1;
}

console.log(find(23));
