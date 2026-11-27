function buildOrder(needs: Graph): string[] {
  const names = Object.keys(needs);
  const order: string[] = [];
  const placed = new Set<string>();
  while (order.length < names.length) {
    const ready = names.find(name => !placed.has(name) && needs[name].every(need => placed.has(need)));
    if (ready === undefined) break;
    placed.add(ready);
    order.push(ready);
  }
  return order;
}
