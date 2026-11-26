function openTitles(tasks: Task[]): string[] {
  return [...new Set(tasks.filter(t=>t.open).map(t=>t.title))];
}
