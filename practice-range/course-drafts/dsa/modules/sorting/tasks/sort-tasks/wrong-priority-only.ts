function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.priority - b.priority);
}
