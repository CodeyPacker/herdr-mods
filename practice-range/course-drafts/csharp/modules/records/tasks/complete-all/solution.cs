public static List<TaskItem> CompleteAll(List<TaskItem> tasks)
{
    List<TaskItem> result = new List<TaskItem>();
    foreach (TaskItem task in tasks)
    {
        result.Add(task with { Done = true });
    }
    return result;
}
