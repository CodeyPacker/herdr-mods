function kSmallest(values: number[], k: number): number[] {
  const remaining = [...values];
  const smallest: number[] = [];
  while (smallest.length < k && remaining.length > 0) {
    let best = 0;
    for (let index = 1; index < remaining.length; index++) {
      if (remaining[index] < remaining[best]) best = index;
    }
    smallest.push(remaining[best]);
    remaining[best] = remaining[remaining.length - 1];
    remaining.pop();
  }
  return smallest;
}
