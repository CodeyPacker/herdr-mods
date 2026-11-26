function statusText(status: "open" | "done" | null): string {
  if (status === null) return "Unknown";
  if (status === "open") return "Active";
  return "Closed";
}
