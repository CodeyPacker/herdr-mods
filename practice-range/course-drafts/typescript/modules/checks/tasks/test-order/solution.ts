function orderTest(candidate: (first: string, second: string) => string): boolean {
  return candidate("west", "east") === "west/east";
}
