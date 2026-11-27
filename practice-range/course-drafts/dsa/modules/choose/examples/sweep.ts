const meetings: [number, number][] = [[13, 15], [9, 10], [14, 16], [9, 11]];
const sorted = [...meetings].sort((x, y) => x[0] - y[0]);
console.log(sorted.map(meeting => meeting.join("-")).join(" "));

let overlaps = 0;
for (let index = 1; index < sorted.length; index++) {
  if (sorted[index][0] < sorted[index - 1][1]) overlaps++;
}
console.log(overlaps);
