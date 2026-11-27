function reachable(graph: Graph, start: string): string[] {
  const seen = new Set<string>([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    for (const next of graph[queue[head]]) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return queue;
}
