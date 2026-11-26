function statusText(status: "open" | "done" | null): string {
  switch (status) {
    case null: return "Unknown";
    case "done": return "Closed";
    case "open": return "Active";
  }
}
