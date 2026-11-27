public static async Task<int> CountOrAsync(string shop, int fallback)
{
    try
    {
        return await Source.CountAsync(shop);
    }
    catch (InvalidOperationException)
    {
        return fallback;
    }
}
