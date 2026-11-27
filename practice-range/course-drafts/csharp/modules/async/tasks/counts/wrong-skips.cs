public static async Task<List<int>> CountsAsync(List<string> shops)
{
    List<int> counts = new List<int>();
    foreach (string shop in shops)
    {
        try
        {
            counts.Add(await Source.CountAsync(shop));
        }
        catch (InvalidOperationException)
        {
        }
    }
    return counts;
}
