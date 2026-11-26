const ids = ["A","A","B"];
const seen = new Set<string>();
let duplicates = 0;
for (const id of ids) { if(seen.has(id)) duplicates++; else seen.add(id); }
console.log(seen.size);
console.log(duplicates);
