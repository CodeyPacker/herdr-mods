function describe(update: Update): string {
  switch (update.kind) {
    case "progress":
      return "Progress: " + update.percent + "%";
    case "blocked":
      return "Blocked: " + (update.reason.length > 0 ? update.reason : "no reason given");
  }
}
