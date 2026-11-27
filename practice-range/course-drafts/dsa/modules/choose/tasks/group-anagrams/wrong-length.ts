function groupAnagrams(words: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const word of words) {
    const key = String(word.length);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [word]);
    else group.push(word);
  }
  return [...groups.values()];
}
