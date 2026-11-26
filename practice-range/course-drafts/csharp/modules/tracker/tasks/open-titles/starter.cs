public static async Task<List<string>> OpenTitlesAsync(ITaskReader reader)
{
    List<TaskItem> tasks = await reader.ReadAsync();
    return new List<string>();
}
