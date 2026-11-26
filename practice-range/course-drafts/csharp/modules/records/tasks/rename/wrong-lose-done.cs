public static TaskItem Rename(TaskItem task, string title)
{
    return new TaskItem(task.Id, title, false);
}
