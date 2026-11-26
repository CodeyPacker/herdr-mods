// Supplied types. The checks call your code directly.
type Update =
  | { kind: "progress"; percent: number }
  | { kind: "blocked"; reason: string };
