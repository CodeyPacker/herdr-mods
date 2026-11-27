function countWords(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) {
    const current = counts.get(word);
    if (current === undefined) counts.set(word, 1);
    else counts.set(word, current + 1);
  }
  return counts;
}
