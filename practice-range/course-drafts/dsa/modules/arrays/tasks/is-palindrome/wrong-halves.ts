function isPalindrome(text: string): boolean {
  const half = Math.floor(text.length / 2);
  return text.slice(0, half) === text.slice(text.length - half);
}
