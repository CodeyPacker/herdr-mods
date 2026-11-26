function openTitles(tasks: Task[]): string[] {
  return tasks.filter(t => t.open).map(t => t.title);
}
