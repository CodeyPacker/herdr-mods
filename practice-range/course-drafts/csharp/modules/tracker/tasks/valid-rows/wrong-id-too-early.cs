public static List<TaskItem> ValidTasks(List<Row> rows)
{
    List<TaskItem> tasks = new List<TaskItem>();
    HashSet<int> seen = new HashSet<int>();
    foreach (Row row in rows)
    {
        if (!int.TryParse(row.Id, out int id) || id <= 0)
        {
            continue;
        }
        if (!seen.Add(id))
        {
            continue;
        }
        if (row.Title == "")
        {
            continue;
        }
        tasks.Add(new TaskItem(id, row.Title, row.Owner, false));
    }
    return tasks;
}
