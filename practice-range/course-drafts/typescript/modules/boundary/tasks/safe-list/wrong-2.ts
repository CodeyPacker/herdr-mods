function labelsOnly(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(x => typeof x === "string");
}
