public static List<string> OpenTitles(List<TaskItem> tasks)
{
    return tasks.Select(task => task.Title).ToList();
}
