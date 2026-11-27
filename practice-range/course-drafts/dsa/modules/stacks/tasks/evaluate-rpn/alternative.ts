function evaluateRpn(tokens: string[]): number {
  const operators: Record<string, (left: number, right: number) => number> = {
    "+": (left, right) => left + right,
    "-": (left, right) => left - right,
    "*": (left, right) => left * right,
  };
  const stack: number[] = [];
  for (const token of tokens) {
    const operator = operators[token];
    if (operator === undefined) {
      stack.push(Number(token));
      continue;
    }
    const right = stack.pop()!;
    const left = stack.pop()!;
    stack.push(operator(left, right));
  }
  return stack[stack.length - 1];
}
