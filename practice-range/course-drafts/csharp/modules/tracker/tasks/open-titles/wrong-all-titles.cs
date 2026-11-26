public static async Task<List<string>> OpenTitlesAsync(ITaskReader reader)
{
    try
    {
        List<TaskItem> tasks = await reader.ReadAsync();
        return tasks.Select(task => task.Title).ToList();
    }
    catch (InvalidOperationException)
    {
        return new List<string>();
    }
}
