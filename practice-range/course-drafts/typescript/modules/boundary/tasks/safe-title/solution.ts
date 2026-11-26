function safeTitle(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  if ("title" in value && typeof value.title === "string") return value.title;
  return null;
}
