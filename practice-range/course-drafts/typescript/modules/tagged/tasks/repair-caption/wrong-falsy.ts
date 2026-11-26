function caption(entry: Entry): string {
  if (entry.kind === "blocked" && entry.reason) return entry.reason;
  return "Ready";
}
