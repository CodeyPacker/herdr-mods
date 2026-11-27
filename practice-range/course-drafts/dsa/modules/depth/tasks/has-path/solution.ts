function hasPath(graph: Graph, from: string, to: string): boolean {
  const seen = new Set<string>();
  function visit(name: string): boolean {
    if (name === to) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return graph[name].some(next => visit(next));
  }
  return visit(from);
}
