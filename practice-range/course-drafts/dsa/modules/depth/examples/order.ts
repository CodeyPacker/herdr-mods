// An edge from a to b means: a must come before b.
const next: Record<string, string[]> = { a: ["b", "c"], b: ["d"], c: ["d"], d: [] };
const seen = new Set<string>();
const left: string[] = [];

function visit(node: string): void {
  if (seen.has(node)) return;
  seen.add(node);
  for (const neighbour of next[node]) visit(neighbour);
  left.push(node);
}

for (const node of Object.keys(next)) visit(node);
console.log(left.reverse().join(" "));
