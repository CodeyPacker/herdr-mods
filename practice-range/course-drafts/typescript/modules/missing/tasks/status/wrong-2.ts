function statusText(status: "open" | "done" | null): string {
  return status === "open" ? "Active" : "Closed";
}
