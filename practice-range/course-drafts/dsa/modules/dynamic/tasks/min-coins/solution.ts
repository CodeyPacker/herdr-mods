function minCoins(coins: number[], amount: number): number {
  const best: number[] = new Array(amount + 1).fill(Infinity);
  best[0] = 0;
  for (let total = 1; total <= amount; total++) {
    for (const coin of coins) {
      if (coin <= total && best[total - coin] + 1 < best[total]) best[total] = best[total - coin] + 1;
    }
  }
  return best[amount] === Infinity ? -1 : best[amount];
}
