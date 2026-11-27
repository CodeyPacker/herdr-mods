function countLoans(input: unknown): Map<string, number> | "invalid" {
  if (!Array.isArray(input)) return "invalid";
  const counts = new Map<string, number>();
  for (const item of input) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string") continue;
    if (typeof record.borrower === "string") counts.set(record.borrower, (counts.get(record.borrower) ?? 0) + 1);
  }
  return counts;
}
