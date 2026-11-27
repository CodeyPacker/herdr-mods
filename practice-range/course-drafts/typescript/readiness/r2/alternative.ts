function countLoans(input: unknown): Map<string, number> | "invalid" {
  if (!Array.isArray(input)) return "invalid";
  const counts = new Map<string, number>();
  input.forEach((item: unknown) => {
    if (typeof item === "object" && item !== null && "kind" in item && item.kind === "book" && "id" in item && typeof item.id === "string" && "borrower" in item && typeof item.borrower === "string") {
      counts.set(item.borrower, (counts.get(item.borrower) ?? 0) + 1);
    }
  });
  return counts;
}
