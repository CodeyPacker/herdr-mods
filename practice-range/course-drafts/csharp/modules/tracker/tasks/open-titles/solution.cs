public static async Task<List<string>> OpenTitlesAsync(ITaskReader reader)
{
    List<TaskItem> tasks;
    try
    {
        tasks = await reader.ReadAsync();
    }
    catch (InvalidOperationException)
    {
        return new List<string>();
    }
    return tasks.Where(task => !task.Done).Select(task => task.Title).ToList();
}
