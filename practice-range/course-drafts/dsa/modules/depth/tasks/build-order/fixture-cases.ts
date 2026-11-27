/** Each name maps to the names it is connected to. */
type Graph = Record<string, string[]>;

const __dress: Graph = { shoes: ["socks", "trousers"], trousers: ["underwear"], socks: [], underwear: [], belt: ["trousers"] };
const __diamond: Graph = { d: ["b", "c"], b: ["a"], c: ["a"], a: [] };

/** True when the order holds every item once and each item comes after what it needs. */
function __valid(needs: Graph, order: string[]): boolean {
  const names = Object.keys(needs);
  if (order.length !== names.length || new Set(order).size !== names.length) return false;
  const position = new Map(order.map((name, index) => [name, index] as const));
  return names.every(name => position.has(name)
    && needs[name].every(need => (position.get(need) ?? Infinity) < position.get(name)!));
}
