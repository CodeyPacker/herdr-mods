type Preview = Pick<Article, "id" | "title">;
type Patch = Partial<Omit<Article, "id">>;
