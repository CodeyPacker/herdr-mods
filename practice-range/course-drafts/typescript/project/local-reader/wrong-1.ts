import { TaskStore } from "./store.js";

export async function openTitles(store: TaskStore): Promise<string[] | "unavailable" | "invalid"> {
  let data: unknown;
  try {
    data = await store.read();
  } catch {
    return "unavailable";
  }
  if (!Array.isArray(data)) return "invalid";
  const titles: string[] = [];
  for (const item of data) {
    if (typeof item === "object" && item !== null && "title" in item && "done" in item && typeof item.title === "string" && item.title && item.done === false) titles.push(item.title);
  }
  return titles;
}
