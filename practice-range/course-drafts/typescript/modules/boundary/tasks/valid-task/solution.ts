function validMember(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return "id" in value && typeof value.id === "string" && value.id.length > 0
    && "active" in value && typeof value.active === "boolean";
}
