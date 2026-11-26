export type ReadBatch = () => Promise<unknown>;

export type Report =
  | { kind: "unavailable" }
  | { kind: "invalid-batch" }
  | { kind: "report"; open: number; done: number; rejected: number; duplicates: number };

export type Audit = (read: ReadBatch) => Promise<Report>;
