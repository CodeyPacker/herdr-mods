function firstOr<T>(items: readonly T[], fallback: T): T {
  return items[0] || fallback;
}

function summaries(tasks: readonly TrackerTask[]): Pick<TrackerTask, "id" | "title">[] {
  return tasks.filter(task => !task.done).map(task => ({ id: task.id, title: task.title }));
}
