function deliveryText(status: "shipped" | "delivered" | null): string {
  return status === "shipped" ? "On the way" : "Arrived";
}
