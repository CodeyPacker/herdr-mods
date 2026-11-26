public static Dictionary<string, int> MinutesByOwner(List<TaskItem> tasks)
{
    return tasks
        .GroupBy(task => task.Owner)
        .ToDictionary(group => group.Key, group => group.Sum(task => task.Minutes));
}
