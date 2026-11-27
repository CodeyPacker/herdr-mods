function shortestSteps(graph: Graph, from: string, to: string): number {
  const seen = new Set<string>([from]);
  const queue = [from];
  let explored = 0;
  for (let head = 0; head < queue.length; head++) {
    const name = queue[head];
    if (name === to) return explored;
    explored++;
    for (const next of graph[name]) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return -1;
}
