function caption(door: Door): string {
  if (door.kind === "open") return "Open";
  return door.reason;
}
