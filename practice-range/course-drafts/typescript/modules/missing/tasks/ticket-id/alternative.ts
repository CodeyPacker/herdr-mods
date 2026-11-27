function orderLabel(input: string | number): string {
  if (typeof input === "string") return input;
  return "#" + input;
}
