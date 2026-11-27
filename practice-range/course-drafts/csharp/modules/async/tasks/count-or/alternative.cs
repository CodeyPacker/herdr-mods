public static async Task<int> CountOrAsync(string shop, int fallback)
{
    int result = fallback;
    try
    {
        int count = await Source.CountAsync(shop);
        result = count;
    }
    catch (InvalidOperationException)
    {
    }
    return result;
}
