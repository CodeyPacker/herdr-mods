function isPalindrome(text: string): boolean {
  if (text.length === 0) return true;
  return text[0] === text[text.length - 1];
}
