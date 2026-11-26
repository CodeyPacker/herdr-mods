function safeTitle(value: unknown): string | null {
  if (value && typeof value === "object" && "title" in value && typeof value.title === "string" && value.title) return value.title;
  return null;
}
