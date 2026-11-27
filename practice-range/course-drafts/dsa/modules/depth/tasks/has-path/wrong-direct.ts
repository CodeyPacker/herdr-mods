function hasPath(graph: Graph, from: string, to: string): boolean {
  return from === to || graph[from].includes(to);
}
