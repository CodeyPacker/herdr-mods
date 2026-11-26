function lookup(titles: Map<number, string>, id: number): string | null {
  const title = titles.get(id);
  if (title === undefined) return null;
  return title;
}
