function sumNested(value: Nested): number {
  return typeof value === "number"
    ? value
    : value.reduce((total: number, item) => total + sumNested(item), 0);
}
