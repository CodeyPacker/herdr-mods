function climbWays(n: number): number {
  const ways = [0, 1];
  for (let step = 2; step <= n; step++) ways[step] = ways[step - 1] + ways[step - 2];
  return n === 0 ? 1 : ways[n];
}
