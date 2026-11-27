function validMember(value: unknown): boolean {
  return value !== null && typeof value === "object" && "id" in value && typeof value.id==="string" && value.id.length>0 && "active" in value && value.active===true;
}
