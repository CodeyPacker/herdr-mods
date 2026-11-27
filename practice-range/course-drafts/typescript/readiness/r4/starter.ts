function firstOr<T>(items: readonly T[], fallback: T): T {
  return fallback;
}

function drafts(articles: readonly Article[]): Pick<Article, "id" | "title">[] {
  return [];
}

function pluck<T>(items: readonly T[], key: keyof T): unknown[] {
  return [];
}
