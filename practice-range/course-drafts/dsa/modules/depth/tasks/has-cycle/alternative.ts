function hasCycle(graph: Graph): boolean {
  const incoming = new Map<string, number>();
  for (const name of Object.keys(graph)) incoming.set(name, 0);
  for (const name of Object.keys(graph)) {
    for (const next of graph[name]) incoming.set(next, (incoming.get(next) ?? 0) + 1);
  }
  const ready = [...incoming.keys()].filter(name => incoming.get(name) === 0);
  let removed = 0;
  for (let head = 0; head < ready.length; head++) {
    removed++;
    for (const next of graph[ready[head]]) {
      const left = incoming.get(next)! - 1;
      incoming.set(next, left);
      if (left === 0) ready.push(next);
    }
  }
  return removed < incoming.size;
}
