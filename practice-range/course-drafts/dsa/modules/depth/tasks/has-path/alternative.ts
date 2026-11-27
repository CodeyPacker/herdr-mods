function hasPath(graph: Graph, from: string, to: string): boolean {
  const seen = new Set<string>([from]);
  const waiting = [from];
  while (waiting.length > 0) {
    const name = waiting.pop()!;
    if (name === to) return true;
    for (const next of graph[name]) {
      if (seen.has(next)) continue;
      seen.add(next);
      waiting.push(next);
    }
  }
  return false;
}
