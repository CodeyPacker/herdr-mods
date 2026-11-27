public static async Task<int> CountOrAsync(string shop, int fallback)
{
    int count = await Source.CountAsync(shop);
    return count;
}
