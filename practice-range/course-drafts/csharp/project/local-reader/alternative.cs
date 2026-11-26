public static async Task<LoadResult> LoadAsync(IRowReader reader)
{
    try
    {
        List<Row> rows = await reader.ReadAsync();
        List<TaskItem> tasks = rows
            .Where(row => row.Title != "" && int.TryParse(row.Id, out int id) && id > 0)
            .Select(row => new TaskItem(int.Parse(row.Id), row.Title, false))
            .ToList();
        return new LoadResult(true, tasks, "");
    }
    catch (InvalidOperationException)
    {
        return new LoadResult(false, new List<TaskItem>(), "unavailable");
    }
}
