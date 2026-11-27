function shortestSteps(graph: Graph, from: string, to: string): number {
  const seen = new Set<string>([from]);
  let ring = [from];
  let steps = 0;
  while (ring.length > 0) {
    if (ring.includes(to)) return steps;
    const nextRing: string[] = [];
    for (const name of ring) {
      for (const next of graph[name]) {
        if (seen.has(next)) continue;
        seen.add(next);
        nextRing.push(next);
      }
    }
    ring = nextRing;
    steps++;
  }
  return -1;
}
