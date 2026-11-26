public static Dictionary<string, int> CountByStatus(List<TaskItem> tasks)
{
    Dictionary<string, int> counts = new Dictionary<string, int>();
    foreach (TaskItem task in tasks)
    {
        counts[task.Status] = 1;
    }
    return counts;
}
