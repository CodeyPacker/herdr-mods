public static List<TaskItem> Apply(List<TaskItem> tasks, Edit edit)
{
    List<TaskItem> result = new List<TaskItem>();
    foreach (TaskItem task in tasks)
    {
        result.Add(edit switch
        {
            Rename r => task with { Title = r.Title },
            Complete => task with { Done = true },
            Assign a => task with { Owner = a.Owner },
            _ => task
        });
    }
    return result;
}
