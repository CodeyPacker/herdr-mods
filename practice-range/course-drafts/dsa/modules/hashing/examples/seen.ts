const seen = new Set<number>();
let lookups = 0;

function firstRepeat(values: number[]): number | undefined {
  for (const value of values) {
    lookups++;
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
}

console.log(firstRepeat([4, 9, 2, 9, 4]), lookups);
