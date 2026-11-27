public static async Task<List<int>> CountsAsync(List<string> shops)
{
    var counts = new List<int>();
    for (int i = 0; i < shops.Count; i++)
    {
        int count = -1;
        try
        {
            count = await Source.CountAsync(shops[i]);
        }
        catch (InvalidOperationException)
        {
        }
        counts.Add(count);
    }
    return counts;
}
