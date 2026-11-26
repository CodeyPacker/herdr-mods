function movement(before: number, after: number): number {
  if (after < before) return 0;
  return after - before;
}
