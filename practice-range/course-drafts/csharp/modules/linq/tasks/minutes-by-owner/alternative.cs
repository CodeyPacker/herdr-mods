public static Dictionary<string, int> MinutesByOwner(List<TaskItem> tasks)
{
    Dictionary<string, int> totals = new Dictionary<string, int>();
    foreach (TaskItem task in tasks)
    {
        if (task.Done)
        {
            continue;
        }
        totals.TryGetValue(task.Owner, out int current);
        totals[task.Owner] = current + task.Minutes;
    }
    return totals;
}
