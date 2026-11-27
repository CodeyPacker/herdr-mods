function minCoins(coins: number[], amount: number): number {
  const largestFirst = [...coins].sort((a, b) => b - a);
  let left = amount;
  let count = 0;
  for (const coin of largestFirst) {
    while (left >= coin) {
      left -= coin;
      count++;
    }
  }
  return left === 0 ? count : -1;
}
