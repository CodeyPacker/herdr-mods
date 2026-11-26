function countByStatus(tasks: TrackerTask[]): Map<TaskStatus, number> {
  return tasks.reduce((counts, task) => counts.set(task.status, (counts.get(task.status) ?? 0) + 1), new Map<TaskStatus, number>());
}
