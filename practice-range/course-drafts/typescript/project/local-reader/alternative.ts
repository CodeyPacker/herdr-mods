import { TaskStore } from "./store.js";

function openTitle(item: unknown): string | null {
  if (typeof item !== "object" || item === null) return null;
  const record = item as Record<string, unknown>;
  return typeof record.title === "string" && record.done === false ? record.title : null;
}

export async function openTitles(store: TaskStore): Promise<string[] | "unavailable" | "invalid"> {
  const data = await store.read().catch(() => "unavailable" as const);
  if (data === "unavailable") return data;
  if (!Array.isArray(data)) return "invalid";
  return data.map(openTitle).filter((title): title is string => title !== null);
}
