function countGroups(graph: Graph): number {
  const seen = new Set<string>();
  function mark(name: string): void {
    if (seen.has(name)) return;
    seen.add(name);
    for (const next of graph[name]) mark(next);
  }
  let groups = 0;
  for (const name of Object.keys(graph)) {
    if (seen.has(name)) continue;
    groups++;
    mark(name);
  }
  return groups;
}
