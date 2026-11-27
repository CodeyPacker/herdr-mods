function isBalanced(text: string): boolean {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (const character of text) {
    if ("([{".includes(character)) stack.push(character);
    else if (character in pairs) {
      if (stack.pop() !== pairs[character]) return false;
    }
  }
  return true;
}
