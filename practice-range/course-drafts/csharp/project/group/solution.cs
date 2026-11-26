public static Dictionary<string, int> CountByStatus(List<TaskItem> tasks)
{
    return tasks.GroupBy(task => task.Status).ToDictionary(group => group.Key, group => group.Count());
}
