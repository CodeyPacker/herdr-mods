function power(base: number, exponent: number): number {
  if (exponent === 0) return 1;
  if (exponent === 1) return base;
  const half = power(base, Math.floor(exponent / 2));
  return times(half, half);
}
