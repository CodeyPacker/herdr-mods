function describe(update: Update): string {
  if (update.kind === "progress" && update.percent) return `Progress: ${update.percent}%`;
  if (update.kind === "progress") return "Progress: unknown";
  return `Blocked: ${update.reason || "no reason given"}`;
}
