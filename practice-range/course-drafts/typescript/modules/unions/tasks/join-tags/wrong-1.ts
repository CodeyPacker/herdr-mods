function joinTags(tags: string | string[]): string {
  return Array.isArray(tags) ? tags.join(",") : tags;
}
