function orderTest(candidate: (first: string, second: string) => string): boolean {
  const expected = "a/b";
  return candidate("a", "b") === expected;
}
