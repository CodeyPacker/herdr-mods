function lookup(titles: Map<number, string>, id: number): string | null {
  return titles.get(id) ?? "";
}
