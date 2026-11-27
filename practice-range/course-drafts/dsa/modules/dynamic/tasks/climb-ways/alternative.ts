function climbWays(n: number): number {
  const memo = new Map<number, number>();
  function ways(steps: number): number {
    if (steps <= 1) return 1;
    const known = memo.get(steps);
    if (known !== undefined) return known;
    const value = ways(steps - 1) + ways(steps - 2);
    memo.set(steps, value);
    return value;
  }
  return ways(n);
}
