function buildOrder(needs: Graph): string[] {
  const order: string[] = [];
  const placed = new Set<string>();
  function place(name: string): void {
    if (placed.has(name)) return;
    placed.add(name);
    for (const need of needs[name]) place(need);
    order.push(name);
  }
  for (const name of Object.keys(needs)) place(name);
  return order;
}
