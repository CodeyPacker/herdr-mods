function longestCommon(a: string, b: string): number {
  const letters = new Set(a);
  let count = 0;
  for (const letter of b) {
    if (letters.has(letter)) count++;
  }
  return count;
}
