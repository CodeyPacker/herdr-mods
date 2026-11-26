public static List<TaskItem> ValidTasks(List<Row> rows)
{
    List<TaskItem> tasks = new List<TaskItem>();
    foreach (Row row in rows)
    {
        if (!int.TryParse(row.Id, out int id) || id <= 0 || row.Title == "")
        {
            continue;
        }
        tasks.Add(new TaskItem(id, row.Title, row.Owner, false));
    }
    return tasks;
}
