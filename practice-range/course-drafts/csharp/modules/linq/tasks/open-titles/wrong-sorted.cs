public static List<string> OpenTitles(List<TaskItem> tasks)
{
    return tasks.Where(task => !task.Done).Select(task => task.Title).OrderBy(title => title).ToList();
}
