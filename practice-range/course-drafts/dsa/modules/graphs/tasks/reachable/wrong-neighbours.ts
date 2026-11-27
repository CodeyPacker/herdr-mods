function reachable(graph: Graph, start: string): string[] {
  return [start, ...graph[start]];
}
