function describe(update: Update): string {
  if (update.kind === "done") return "Minutes: " + update.minutes;
  return "Next: " + update.title;
}
