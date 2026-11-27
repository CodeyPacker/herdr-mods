function halvings(n: number): number {
  let steps = 0;
  while (n > 1) {
    n = Math.floor(n / 2);
    steps++;
  }
  return steps;
}

console.log(halvings(8));
console.log(halvings(1024));
console.log(halvings(1000000));
