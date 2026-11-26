function caption(entry: Entry): string {
  const text = entry.reason;
  if (entry.kind === "blocked") return text;
  return "Ready";
}
