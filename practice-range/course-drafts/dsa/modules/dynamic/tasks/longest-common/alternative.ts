function longestCommon(a: string, b: string): number {
  const memo = new Map<string, number>();
  function from(i: number, j: number): number {
    if (i === a.length || j === b.length) return 0;
    const key = i + "," + j;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const value = a[i] === b[j] ? 1 + from(i + 1, j + 1) : Math.max(from(i + 1, j), from(i, j + 1));
    memo.set(key, value);
    return value;
  }
  return from(0, 0);
}
