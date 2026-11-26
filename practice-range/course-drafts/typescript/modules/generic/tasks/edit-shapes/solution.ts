type Preview = Pick<Task, "id" | "title">;
type Patch = Partial<Omit<Task, "id">>;
