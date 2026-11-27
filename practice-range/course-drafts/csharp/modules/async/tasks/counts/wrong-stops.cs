public static async Task<List<int>> CountsAsync(List<string> shops)
{
    List<int> counts = new List<int>();
    try
    {
        foreach (string shop in shops)
        {
            counts.Add(await Source.CountAsync(shop));
        }
    }
    catch (InvalidOperationException)
    {
        counts.Add(-1);
    }
    return counts;
}
