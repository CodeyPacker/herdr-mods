function hasPath(graph: Graph, from: string, to: string): boolean {
  if (from === to) return true;
  for (const next of graph[from]) {
    if (hasPath(graph, next, to)) return true;
  }
  return false;
}
