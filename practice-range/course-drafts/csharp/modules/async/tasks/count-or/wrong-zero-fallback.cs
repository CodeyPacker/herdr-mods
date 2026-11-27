public static async Task<int> CountOrAsync(string shop, int fallback)
{
    try
    {
        int count = await Source.CountAsync(shop);
        if (count == 0)
        {
            return fallback;
        }
        return count;
    }
    catch (InvalidOperationException)
    {
        return fallback;
    }
}
