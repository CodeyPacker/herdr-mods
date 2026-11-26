public static List<TaskItem> Apply(List<TaskItem> tasks, Edit edit)
{
    for (int i = 0; i < tasks.Count; i++)
    {
        if (tasks[i].Id != edit.Id)
        {
            continue;
        }
        tasks[i] = edit switch
        {
            Rename r => tasks[i] with { Title = r.Title },
            Complete => tasks[i] with { Done = true },
            Assign a => tasks[i] with { Owner = a.Owner },
            _ => tasks[i]
        };
    }
    return tasks;
}
