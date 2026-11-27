function commonSorted(a: number[], b: number[]): number[] {
  const inFirst = new Set(a);
  const common: number[] = [];
  for (const value of b) {
    if (inFirst.has(value) && common[common.length - 1] !== value) common.push(value);
  }
  return common;
}
