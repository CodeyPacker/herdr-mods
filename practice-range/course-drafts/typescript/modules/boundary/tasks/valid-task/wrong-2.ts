function validTask(value: unknown): boolean {
  return value !== null && typeof value === "object" && "id" in value && typeof value.id==="string" && value.id.length>0 && "done" in value && value.done===true;
}
