function validTask(value: unknown): boolean {
  return value !== null && typeof value === "object" && "id" in value && "done" in value;
}
