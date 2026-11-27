function firstOr<T>(items: readonly T[], fallback: T): T {
  for (const item of items) return item;
  return fallback;
}

function drafts(articles: readonly Article[]): Pick<Article, "id" | "title">[] {
  const result: Pick<Article, "id" | "title">[] = [];
  for (const { id, title, published } of articles) if (published === false) result.push({ id, title });
  return result;
}

function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  const values: T[K][] = [];
  for (const item of items) values.push(item[key]);
  return values;
}
