type Edit =
  | { kind: "add"; amount: number }
  | { kind: "set"; value: number }
  | { kind: "keep" };
