function sumNested(value: Nested): number {
  if (typeof value === "number") return value;
  let total = 0;
  for (const item of value) {
    if (typeof item === "number") total += item;
  }
  return total;
}
