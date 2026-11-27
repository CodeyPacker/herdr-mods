function countGroups(graph: Graph): number {
  const seen = new Set<string>();
  let groups = 0;
  for (const start of Object.keys(graph)) {
    if (seen.has(start)) continue;
    groups++;
    seen.add(start);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      for (const next of graph[queue[head]]) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return groups;
}
