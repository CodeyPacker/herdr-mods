public static Dictionary<string, int> MinutesByOwner(List<TaskItem> tasks)
{
    return tasks
        .Where(task => !task.Done)
        .GroupBy(task => task.Owner)
        .ToDictionary(group => group.Key, group => group.Count());
}
