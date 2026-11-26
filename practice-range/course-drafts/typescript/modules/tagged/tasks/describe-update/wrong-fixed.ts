function describe(update: Update): string {
  if (update.kind === "queued") return "Next: " + update.title;
  return "Minutes: 0";
}
