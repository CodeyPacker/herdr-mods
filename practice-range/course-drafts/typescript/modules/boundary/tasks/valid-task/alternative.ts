function validMember(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!("id" in value) || typeof value.id !== "string" || value.id === "") return false;
  return "active" in value && (value.active === false || value.active === true);
}
