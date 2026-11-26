function caption(entry: Entry): string {
  if (entry.kind === "ready") return "Ready";
  return entry.reason;
}
