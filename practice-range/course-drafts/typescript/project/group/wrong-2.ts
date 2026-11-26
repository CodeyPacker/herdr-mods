function countByStatus(tasks: TrackerTask[]): Map<TaskStatus, number> {
  const counts = new Map<TaskStatus, number>();
  for (const task of tasks.slice(1)) counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
  return counts;
}
