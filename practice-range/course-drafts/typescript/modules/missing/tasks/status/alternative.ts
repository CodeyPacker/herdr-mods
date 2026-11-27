function deliveryText(status: "shipped" | "delivered" | null): string {
  switch (status) {
    case null: return "Unknown";
    case "delivered": return "Arrived";
    case "shipped": return "On the way";
  }
}
