public static List<string> OpenTitles(List<TaskItem> tasks)
{
    List<string> titles = new List<string>();
    foreach (TaskItem task in tasks)
    {
        if (task.Done == false)
        {
            titles.Add(task.Title);
        }
    }
    return titles;
}
