function climbWays(n: number): number {
  if (n <= 1) return 1;
  return climbWays(n - 1) + climbWays(n - 2);
}
