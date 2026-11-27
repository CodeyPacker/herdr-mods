function evaluateRpn(tokens: string[]): number {
  const waiting: number[] = [];
  for (const token of tokens) {
    if (token === "+" || token === "-" || token === "*") {
      const left = waiting.shift()!;
      const right = waiting.shift()!;
      if (token === "+") waiting.push(left + right);
      else if (token === "-") waiting.push(left - right);
      else waiting.push(left * right);
    } else {
      waiting.push(Number(token));
    }
  }
  return waiting[0];
}
