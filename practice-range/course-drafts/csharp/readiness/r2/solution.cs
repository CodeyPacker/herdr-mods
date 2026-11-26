public static TaskItem Renamed(TaskItem task, string title)
{
    return task with { Title = title };
}

public static Dictionary<string, int> CountByOwner(List<TaskItem> tasks)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (TaskItem task in tasks)
    {
        string key = task.Owner ?? "Unassigned";
        if (counts.ContainsKey(key))
        {
            counts[key] = counts[key] + 1;
        }
        else
        {
            counts[key] = 1;
        }
    }
    return counts;
}
