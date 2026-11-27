function orderLabel(input: string | number): string {
  if (typeof input === "number") return "#" + String(input);
  return input;
}
