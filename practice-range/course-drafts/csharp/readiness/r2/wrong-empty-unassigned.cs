public static TaskItem Renamed(TaskItem task, string title)
{
    return task with { Title = title };
}

public static Dictionary<string, int> CountByOwner(List<TaskItem> tasks)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (TaskItem task in tasks)
    {
        string key = task.Owner == null || task.Owner == "" ? "Unassigned" : task.Owner;
        counts.TryGetValue(key, out int current);
        counts[key] = current + 1;
    }
    return counts;
}
