function orderTest(candidate: (first: string, second: string) => string): boolean {
  return candidate("a","b")==="b/a";
}
