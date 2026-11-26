export type Task = { id: string; done: boolean };
export function isTask(value: unknown): value is Task { return typeof value === "object" && value !== null && !Array.isArray(value) && "id" in value && typeof value.id === "string" && value.id.length > 0 && "done" in value && typeof value.done === "boolean"; }
