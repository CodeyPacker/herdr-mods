function buildOrder(needs: Graph): string[] {
  const order: string[] = [];
  function place(name: string): void {
    for (const need of needs[name]) place(need);
    order.push(name);
  }
  for (const name of Object.keys(needs)) place(name);
  return order;
}
