const a = Array.from({ length: 1000 }, (_, index) => index);
const b = Array.from({ length: 1000 }, (_, index) => index + 5000);

// Compare every pair.
let nested = 0;
for (const x of a) {
  for (const y of b) {
    nested++;
    if (x === y) break;
  }
}

// Build a Set from b, then look each value of a up in it.
const lookup = new Set(b);
let withSet = b.length;
for (const x of a) {
  withSet++;
  if (lookup.has(x)) break;
}

console.log(nested, withSet);
