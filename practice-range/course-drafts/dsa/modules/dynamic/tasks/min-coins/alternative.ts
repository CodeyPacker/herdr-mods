function minCoins(coins: number[], amount: number): number {
  const memo = new Map<number, number>();
  function fewest(total: number): number {
    if (total === 0) return 0;
    if (total < 0) return Infinity;
    const known = memo.get(total);
    if (known !== undefined) return known;
    let best = Infinity;
    for (const coin of coins) best = Math.min(best, fewest(total - coin) + 1);
    memo.set(total, best);
    return best;
  }
  const answer = fewest(amount);
  return answer === Infinity ? -1 : answer;
}
