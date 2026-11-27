function isBalanced(text: string): boolean {
  let open = 0;
  for (const character of text) {
    if ("([{".includes(character)) open++;
    if (")]}".includes(character)) open--;
    if (open < 0) return false;
  }
  return open === 0;
}
