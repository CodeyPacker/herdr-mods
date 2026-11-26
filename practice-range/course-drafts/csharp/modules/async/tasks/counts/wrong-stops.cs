public static async Task<List<int>> CountsAsync(List<string> boards)
{
    List<int> counts = new List<int>();
    try
    {
        foreach (string board in boards)
        {
            counts.Add(await Source.CountAsync(board));
        }
    }
    catch (InvalidOperationException)
    {
        counts.Add(-1);
    }
    return counts;
}
