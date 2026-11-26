function countByStatus(tasks: TrackerTask[]): Map<TaskStatus, number> {
  const counts = new Map<TaskStatus, number>();
  for (const task of tasks) counts.set(task.status, 1);
  return counts;
}
