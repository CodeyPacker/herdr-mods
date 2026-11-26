function ownersOf(input: unknown): Map<string, number> | "invalid" {
  if (!Array.isArray(input)) return "invalid";
  const counts = new Map<string, number>();
  for (const item of input) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (record.kind !== "task" || typeof record.id !== "string") continue;
    if (typeof record.owner === "string") counts.set(record.owner, (counts.get(record.owner) ?? 0) + 1);
  }
  return counts;
}
