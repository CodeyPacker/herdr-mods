function firstOr<T>(items: readonly T[], fallback: T): T {
  return items.length > 0 ? items[0] : fallback;
}

function drafts(articles: readonly Article[]): Pick<Article, "id" | "title">[] {
  return articles.filter(article => !article.published).map(article => ({ ...article }));
}

function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map(item => item[key]);
}
