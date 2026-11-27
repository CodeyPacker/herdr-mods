function evaluateRpn(tokens: string[]): number {
  const stack: number[] = [];
  for (const token of tokens) {
    if (token === "+" || token === "-" || token === "*") {
      const first = stack.pop()!;
      const second = stack.pop()!;
      if (token === "+") stack.push(first + second);
      else if (token === "-") stack.push(first - second);
      else stack.push(first * second);
    } else {
      stack.push(Number(token));
    }
  }
  return stack[0];
}
