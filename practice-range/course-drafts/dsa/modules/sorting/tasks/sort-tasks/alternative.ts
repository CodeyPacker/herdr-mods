function sortTasks(tasks: Task[]): Task[] {
  const byTitle = [...tasks].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  return byTitle.sort((a, b) => a.priority - b.priority);
}
