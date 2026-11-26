public static List<TaskItem> CompleteAll(List<TaskItem> tasks)
{
    for (int i = 0; i < tasks.Count; i++)
    {
        tasks[i] = tasks[i] with { Done = true };
    }
    return tasks;
}
