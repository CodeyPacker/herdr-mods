function validTask(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!("id" in value) || typeof value.id !== "string" || value.id === "") return false;
  return "done" in value && (value.done === false || value.done === true);
}
