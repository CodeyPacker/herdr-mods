function isBalanced(text: string): boolean {
  const closers: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const expected: string[] = [];
  for (const character of text) {
    if (character in closers) expected.push(closers[character]);
    else if (")]}".includes(character)) {
      if (expected.length === 0 || expected.pop() !== character) return false;
    }
  }
  return expected.length === 0;
}
