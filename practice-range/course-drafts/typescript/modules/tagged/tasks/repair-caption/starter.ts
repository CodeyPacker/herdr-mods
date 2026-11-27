function caption(door: Door): string {
  const text = door.reason;
  if (door.kind === "locked") return text;
  return "Open";
}
