function power(base: number, exponent: number): number {
  if (exponent === 0) return 1;
  return times(base, power(base, exponent - 1));
}
