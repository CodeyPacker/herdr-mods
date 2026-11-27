/** Each name maps to the names it is connected to. */
type Graph = Record<string, string[]>;

const __roads: Graph = {
  home: ["shop", "park"],
  shop: ["home", "school"],
  park: ["home", "school"],
  school: ["shop", "park", "library"],
  library: ["school"],
};
const __islands: Graph = { a: ["b"], b: ["a"], c: [], d: ["e"], e: ["d"] };
