public static IEnumerable<string> LongTitles(List<TaskItem> tasks, int limit)
{
    List<string> titles = new List<string>();
    foreach (TaskItem task in tasks)
    {
        if (task.Minutes > limit)
        {
            titles.Add(task.Title);
        }
    }
    return titles;
}
