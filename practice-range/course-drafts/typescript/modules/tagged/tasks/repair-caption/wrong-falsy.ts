function caption(door: Door): string {
  if (door.kind === "locked" && door.reason) return door.reason;
  return "Open";
}
