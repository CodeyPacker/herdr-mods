public static async Task<List<string>> OpenTitlesAsync(ITaskReader reader)
{
    List<TaskItem> tasks = await reader.ReadAsync();
    return tasks.Where(task => !task.Done).Select(task => task.Title).ToList();
}
