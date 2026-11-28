public static async Task<List<int>> CountsAsync(List<string> shops)
{
    List<int> counts = new List<int>();
    for (int i = shops.Count - 1; i >= 0; i--)
    {
        try
        {
            counts.Add(await Source.CountAsync(shops[i]));
        }
        catch (InvalidOperationException)
        {
            counts.Add(-1);
        }
    }
    counts.Reverse();
    return counts;
}
