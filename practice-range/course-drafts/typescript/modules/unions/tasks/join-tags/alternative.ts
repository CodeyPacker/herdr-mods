function joinTags(tags: string | string[]): string {
  return typeof tags === "string" ? tags : tags.join(", ");
}
