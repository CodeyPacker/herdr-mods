function power(base: number, exponent: number): number {
  if (exponent === 0) return 1;
  const half = power(base, Math.floor(exponent / 2));
  const squared = times(half, half);
  return exponent % 2 === 0 ? squared : times(squared, base);
}
