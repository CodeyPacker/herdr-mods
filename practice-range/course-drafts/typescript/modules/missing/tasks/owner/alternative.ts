function ownerName(task: Task): string {
  if (task.owner === undefined || task.owner === null) return "Unassigned";
  return task.owner;
}
