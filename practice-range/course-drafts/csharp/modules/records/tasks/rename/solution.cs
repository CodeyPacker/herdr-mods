public static TaskItem Rename(TaskItem task, string title)
{
    return task with { Title = title };
}
