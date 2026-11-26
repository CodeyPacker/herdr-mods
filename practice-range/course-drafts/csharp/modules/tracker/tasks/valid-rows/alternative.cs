public static List<TaskItem> ValidTasks(List<Row> rows)
{
    var tasks = new List<TaskItem>();
    foreach (Row row in rows)
    {
        int id;
        try
        {
            id = int.Parse(row.Id);
        }
        catch (FormatException)
        {
            continue;
        }
        bool valid = id > 0 && row.Title.Length > 0;
        bool repeated = tasks.Any(task => task.Id == id);
        if (valid && !repeated)
        {
            tasks.Add(new TaskItem(id, row.Title, row.Owner, false));
        }
    }
    return tasks;
}
