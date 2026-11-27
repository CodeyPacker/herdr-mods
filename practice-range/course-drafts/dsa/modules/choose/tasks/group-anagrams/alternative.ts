function groupAnagrams(words: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const word of words) {
    const counts: number[] = new Array(26).fill(0);
    for (const letter of word) counts[letter.charCodeAt(0) - 97]++;
    const key = counts.join(",");
    groups.set(key, [...(groups.get(key) ?? []), word]);
  }
  return [...groups.values()];
}
