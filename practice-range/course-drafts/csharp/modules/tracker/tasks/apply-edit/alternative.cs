public static List<TaskItem> Apply(List<TaskItem> tasks, Edit edit)
{
    return tasks.Select(task =>
    {
        if (task.Id != edit.Id)
        {
            return task;
        }
        if (edit is Rename rename)
        {
            return new TaskItem(task.Id, rename.Title, task.Owner, task.Done);
        }
        if (edit is Assign assign)
        {
            return new TaskItem(task.Id, task.Title, assign.Owner, task.Done);
        }
        if (edit is Complete)
        {
            return new TaskItem(task.Id, task.Title, task.Owner, true);
        }
        return task;
    }).ToList();
}
