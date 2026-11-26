public static TaskItem Renamed(TaskItem task, string title)
{
    return new TaskItem(task.Id, title, task.Owner);
}

public static Dictionary<string, int> CountByOwner(List<TaskItem> tasks)
{
    var counts = new Dictionary<string, int>();
    foreach (TaskItem task in tasks)
    {
        string key = "Unassigned";
        if (task.Owner != null)
        {
            key = task.Owner;
        }
        counts.TryGetValue(key, out int current);
        counts[key] = current + 1;
    }
    return counts;
}
