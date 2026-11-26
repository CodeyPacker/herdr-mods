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
        tasks.Add(new TaskItem(int.Parse(row.Id), row.Title, false));
    }
    return new LoadResult(true, tasks, "");
}
