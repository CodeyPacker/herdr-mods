public static async Task<List<int>> CountsAsync(List<string> boards)
{
    var counts = new List<int>();
    for (int i = 0; i < boards.Count; i++)
    {
        int count = -1;
        try
        {
            count = await Source.CountAsync(boards[i]);
        }
        catch (InvalidOperationException)
        {
        }
        counts.Add(count);
    }
    return counts;
}
