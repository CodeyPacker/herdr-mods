type Delivery =
  | { kind: "sent"; receipt: string }
  | { kind: "failed"; reason: string };
