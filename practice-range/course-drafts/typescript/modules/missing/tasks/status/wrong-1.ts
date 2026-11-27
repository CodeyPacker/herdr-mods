function deliveryText(status: "shipped" | "delivered" | null): string {
  return status === null ? "Unknown" : "On the way";
}
