function sortTasks(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.title < b.title) return -1;
    if (a.title > b.title) return 1;
    return 0;
  });
}
