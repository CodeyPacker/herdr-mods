function joinTags(tags: string | string[]): string {
  if (Array.isArray(tags)) return tags.join(", ");
  return tags;
}
