function caption(entry: Entry): string {
  if (entry.kind === "blocked") return entry.reason;
  return "Ready";
}
