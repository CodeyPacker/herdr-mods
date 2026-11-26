function describe(update: Update): string {
  if (update.kind === "progress") return `Progress: ${update.percent}%`;
  return `Blocked: ${update.reason}`;
}
