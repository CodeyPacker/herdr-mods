public static async Task<List<string>> OpenTitlesAsync(ITaskReader reader)
{
    List<string> titles = new List<string>();
    try
    {
        foreach (TaskItem task in await reader.ReadAsync())
        {
            if (!task.Done)
            {
                titles.Add(task.Title);
            }
        }
    }
    catch (InvalidOperationException)
    {
    }
    return titles;
}
