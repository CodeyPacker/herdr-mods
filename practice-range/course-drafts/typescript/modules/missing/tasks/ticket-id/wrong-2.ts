function orderLabel(input: string | number): string {
  if (typeof input === "number" && input) return "#" + input;
  return String(input);
}
