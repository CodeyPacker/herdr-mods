function validMember(value: unknown): boolean {
  return value !== null && typeof value === "object" && "id" in value && "active" in value;
}
