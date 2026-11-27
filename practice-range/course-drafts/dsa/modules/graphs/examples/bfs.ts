const roads: Record<string, string[]> = {
  home: ["shop", "park"],
  shop: ["home", "school"],
  park: ["home", "school"],
  school: ["shop", "park", "library"],
  library: ["school"],
};

const steps = new Map<string, number>([["home", 0]]);
const queue = ["home"];
for (let head = 0; head < queue.length; head++) {
  const place = queue[head];
  for (const next of roads[place]) {
    if (steps.has(next)) continue;
    steps.set(next, steps.get(place)! + 1);
    queue.push(next);
  }
}

console.log(queue.join(" "));
console.log(steps.get("library"));
