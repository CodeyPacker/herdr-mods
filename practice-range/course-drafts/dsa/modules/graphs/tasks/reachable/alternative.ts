function reachable(graph: Graph, start: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>([start]);
  let ring = [start];
  while (ring.length > 0) {
    const nextRing: string[] = [];
    for (const name of ring) {
      found.push(name);
      for (const next of graph[name]) {
        if (seen.has(next)) continue;
        seen.add(next);
        nextRing.push(next);
      }
    }
    ring = nextRing;
  }
  return found;
}
