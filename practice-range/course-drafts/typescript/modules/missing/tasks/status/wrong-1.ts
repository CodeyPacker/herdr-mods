function statusText(status: "open" | "done" | null): string {
  return status === null ? "Unknown" : "Active";
}
