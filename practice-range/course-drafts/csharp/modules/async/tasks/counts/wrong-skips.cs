public static async Task<List<int>> CountsAsync(List<string> boards)
{
    List<int> counts = new List<int>();
    foreach (string board in boards)
    {
        try
        {
            counts.Add(await Source.CountAsync(board));
        }
        catch (InvalidOperationException)
        {
        }
    }
    return counts;
}
