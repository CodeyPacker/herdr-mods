const ways = [1, 1];
for (let step = 2; step <= 6; step++) {
  ways[step] = ways[step - 1] + ways[step - 2];
}
console.log(ways.join(" "));
