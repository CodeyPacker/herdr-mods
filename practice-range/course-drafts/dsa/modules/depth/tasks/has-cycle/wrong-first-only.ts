function hasCycle(graph: Graph): boolean {
  const state = new Map<string, "visiting" | "done">();
  function visit(name: string): boolean {
    if (state.get(name) === "visiting") return true;
    if (state.get(name) === "done") return false;
    state.set(name, "visiting");
    for (const next of graph[name]) {
      if (visit(next)) return true;
    }
    state.set(name, "done");
    return false;
  }
  const first = Object.keys(graph)[0];
  return first !== undefined && visit(first);
}
