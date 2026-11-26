function openTitles(tasks: Task[]): string[] {
  const titles: string[] = [];
  for (const task of tasks) {
    if (task.open) titles.push(task.title);
  }
  return titles;
}
