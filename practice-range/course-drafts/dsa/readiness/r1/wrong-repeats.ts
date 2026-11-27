function commonSorted(a: number[], b: number[]): number[] {
  const common: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] < b[j]) i++;
    else if (a[i] > b[j]) j++;
    else {
      common.push(a[i]);
      i++;
      j++;
    }
  }
  return common;
}
