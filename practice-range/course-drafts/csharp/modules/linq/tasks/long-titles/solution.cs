public static IEnumerable<string> LongTitles(List<TaskItem> tasks, int limit)
{
    return tasks.Where(task => task.Minutes > limit).Select(task => task.Title).ToList();
}
