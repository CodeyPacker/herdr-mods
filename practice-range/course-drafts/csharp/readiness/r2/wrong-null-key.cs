public static TaskItem Renamed(TaskItem task, string title)
{
    return task with { Title = title };
}

public static Dictionary<string, int> CountByOwner(List<TaskItem> tasks)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (TaskItem task in tasks)
    {
        counts.TryGetValue(task.Owner, out int current);
        counts[task.Owner] = current + 1;
    }
    return counts;
}
