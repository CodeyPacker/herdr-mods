function validTask(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return "id" in value && typeof value.id === "string" && value.id.length > 0
    && "done" in value && typeof value.done === "boolean";
}
