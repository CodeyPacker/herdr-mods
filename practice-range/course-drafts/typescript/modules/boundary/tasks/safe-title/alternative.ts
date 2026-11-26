function safeTitle(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value) && "title" in value) {
    if (typeof value.title === "string") return value.title;
  }
  return null;
}
