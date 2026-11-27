function reachable(graph: Graph, start: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>([start]);
  const waiting = [start];
  while (waiting.length > 0) {
    const name = waiting.pop()!;
    found.push(name);
    for (const next of graph[name]) {
      if (seen.has(next)) continue;
      seen.add(next);
      waiting.push(next);
    }
  }
  return found;
}
