public static async Task<LoadResult> LoadAsync(IRowReader reader)
{
    List<Row> rows = await reader.ReadAsync();
    return new LoadResult(true, new List<TaskItem>(), "");
}
