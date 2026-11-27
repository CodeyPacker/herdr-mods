function climbWays(n: number): number {
  let previous = 1;
  let current = 1;
  for (let step = 2; step <= n; step++) {
    const next = previous + current;
    previous = current;
    current = next;
  }
  return current;
}
