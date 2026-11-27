function isPalindrome(text: string): boolean {
  for (let index = 0; index < text.length / 2; index++) {
    if (text[index] !== text[text.length - 1 - index]) return false;
  }
  return true;
}
