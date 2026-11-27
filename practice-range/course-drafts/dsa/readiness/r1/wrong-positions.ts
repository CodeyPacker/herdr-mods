function commonSorted(a: number[], b: number[]): number[] {
  const common: number[] = [];
  for (let index = 0; index < a.length && index < b.length; index++) {
    if (a[index] === b[index]) common.push(a[index]);
  }
  return common;
}
