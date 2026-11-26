function ownersOf(input: unknown): Map<string, number> | "invalid" {
  if (!Array.isArray(input)) return "invalid";
  const counts = new Map<string, number>();
  input.forEach((item: unknown) => {
    if (typeof item === "object" && item !== null && "kind" in item && item.kind === "task" && "id" in item && typeof item.id === "string" && "owner" in item && typeof item.owner === "string") {
      counts.set(item.owner, (counts.get(item.owner) ?? 0) + 1);
    }
  });
  return counts;
}
