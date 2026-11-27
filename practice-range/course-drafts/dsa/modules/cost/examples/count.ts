function countSingle(n: number): number {
  let steps = 0;
  for (let i = 0; i < n; i++) steps++;
  return steps;
}

function countPairs(n: number): number {
  let steps = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) steps++;
  }
  return steps;
}

console.log(countSingle(10), countPairs(10));
console.log(countSingle(100), countPairs(100));
