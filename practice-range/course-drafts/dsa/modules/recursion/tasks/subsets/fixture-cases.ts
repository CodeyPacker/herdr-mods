/** Puts subsets in a fixed order so that they can be compared. */
function __normal(sets: string[][]): string[][] {
  const key = (set: string[]): string => set.join(",");
  return sets.map(set => [...set].sort()).sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
