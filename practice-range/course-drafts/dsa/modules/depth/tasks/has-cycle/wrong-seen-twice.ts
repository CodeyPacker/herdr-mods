function hasCycle(graph: Graph): boolean {
  const seen = new Set<string>();
  function visit(name: string): boolean {
    if (seen.has(name)) return true;
    seen.add(name);
    for (const next of graph[name]) {
      if (visit(next)) return true;
    }
    return false;
  }
  return Object.keys(graph).some(name => !seen.has(name) && visit(name));
}
