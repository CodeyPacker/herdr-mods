function caption(door: Door): string {
  if (door.kind === "locked") return door.reason;
  return "Open";
}
