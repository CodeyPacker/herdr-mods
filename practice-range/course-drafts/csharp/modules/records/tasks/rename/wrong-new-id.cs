public static TaskItem Rename(TaskItem task, string title)
{
    return new TaskItem(0, title, task.Done);
}
