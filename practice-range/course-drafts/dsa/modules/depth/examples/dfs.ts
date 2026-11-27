const next: Record<string, string[]> = { a: ["b", "c"], b: ["d"], c: ["d"], d: [] };
const seen = new Set<string>();

function visit(node: string): void {
  if (seen.has(node)) return;
  seen.add(node);
  console.log("enter", node);
  for (const neighbour of next[node]) visit(neighbour);
  console.log("leave", node);
}

visit("a");
