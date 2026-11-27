const roads: Record<string, string[]> = {
  home: ["shop", "park"],
  shop: ["home", "school"],
  park: ["home", "school"],
  school: ["shop", "park", "library"],
  library: ["school"],
};

let listed = 0;
for (const place of Object.keys(roads)) listed += roads[place].length;
console.log(Object.keys(roads).length, listed / 2);
