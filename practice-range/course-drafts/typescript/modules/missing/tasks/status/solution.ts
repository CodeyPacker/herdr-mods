function deliveryText(status: "shipped" | "delivered" | null): string {
  if (status === null) return "Unknown";
  if (status === "shipped") return "On the way";
  return "Arrived";
}
