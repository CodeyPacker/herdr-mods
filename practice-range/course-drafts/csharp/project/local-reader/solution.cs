public static async Task<LoadResult> LoadAsync(IRowReader reader)
{
    List<Row> rows;
    try
    {
        rows = await reader.ReadAsync();
    }
    catch (InvalidOperationException)
    {
        return new LoadResult(false, new List<TaskItem>(), "unavailable");
    }
    List<TaskItem> tasks = new List<TaskItem>();
    foreach (Row row in rows)
    {
        if (int.TryParse(row.Id, out int id) && id > 0 && row.Title != "")
        {
            tasks.Add(new TaskItem(id, row.Title, false));
        }
    }
    return new LoadResult(true, tasks, "");
}
