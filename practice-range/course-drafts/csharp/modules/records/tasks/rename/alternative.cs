public static TaskItem Rename(TaskItem task, string title) => new TaskItem(task.Id, title, task.Done);
