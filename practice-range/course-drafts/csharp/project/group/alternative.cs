public static Dictionary<string, int> CountByStatus(List<TaskItem> tasks)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (TaskItem task in tasks)
    {
        if (counts.ContainsKey(task.Status))
        {
            counts[task.Status] = counts[task.Status] + 1;
        }
        else
        {
            counts[task.Status] = 1;
        }
    }
    return counts;
}
