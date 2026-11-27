const words = ["red", "blue", "red", "green", "blue", "red"];
const counts = new Map<string, number>();
for (const word of words) {
  counts.set(word, (counts.get(word) ?? 0) + 1);
}
console.log(counts.get("red"), counts.get("green"), counts.get("pink"));
console.log([...counts.keys()].join(","));
