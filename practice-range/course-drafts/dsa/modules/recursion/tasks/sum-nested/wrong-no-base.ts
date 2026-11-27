function sumNested(value: Nested): number {
  let total = 0;
  for (const item of value as Nested[]) {
    total += typeof item === "number" ? item : sumNested(item);
  }
  return total;
}
