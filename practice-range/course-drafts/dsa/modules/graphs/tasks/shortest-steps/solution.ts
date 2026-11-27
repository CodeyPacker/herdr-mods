function shortestSteps(graph: Graph, from: string, to: string): number {
  const steps = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const name = queue[head];
    if (name === to) return steps.get(name)!;
    for (const next of graph[name]) {
      if (steps.has(next)) continue;
      steps.set(next, steps.get(name)! + 1);
      queue.push(next);
    }
  }
  return -1;
}
