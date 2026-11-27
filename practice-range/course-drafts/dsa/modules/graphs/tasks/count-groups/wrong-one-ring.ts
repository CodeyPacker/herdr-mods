function countGroups(graph: Graph): number {
  const seen = new Set<string>();
  let groups = 0;
  for (const start of Object.keys(graph)) {
    if (seen.has(start)) continue;
    groups++;
    seen.add(start);
    for (const next of graph[start]) seen.add(next);
  }
  return groups;
}
