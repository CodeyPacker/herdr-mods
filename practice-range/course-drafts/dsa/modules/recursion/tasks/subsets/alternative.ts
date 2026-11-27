function subsets(items: string[]): string[][] {
  let result: string[][] = [[]];
  for (const item of items) {
    result = [...result, ...result.map(subset => [...subset, item])];
  }
  return result;
}
