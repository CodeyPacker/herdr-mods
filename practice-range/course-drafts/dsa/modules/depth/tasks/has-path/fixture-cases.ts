/** Each name maps to the names it is connected to. */
type Graph = Record<string, string[]>;

const __line: Graph = { a: ["b"], b: ["c"], c: [] };
const __loop: Graph = { a: ["b"], b: ["a"], c: [] };
