function labelsOnly(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every(item => typeof item === "string");
}
