function power(base: number, exponent: number): number {
  let result = 1;
  let factor = base;
  let remaining = exponent;
  while (remaining > 0) {
    if (remaining % 2 === 1) result = times(result, factor);
    factor = times(factor, factor);
    remaining = Math.floor(remaining / 2);
  }
  return result;
}
