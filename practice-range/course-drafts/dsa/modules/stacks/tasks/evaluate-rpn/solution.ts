function evaluateRpn(tokens: string[]): number {
  const stack: number[] = [];
  for (const token of tokens) {
    if (token === "+" || token === "-" || token === "*") {
      const right = stack.pop()!;
      const left = stack.pop()!;
      if (token === "+") stack.push(left + right);
      else if (token === "-") stack.push(left - right);
      else stack.push(left * right);
    } else {
      stack.push(Number(token));
    }
  }
  return stack[0];
}
