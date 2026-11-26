public static async Task<int> CountOrAsync(string board, int fallback)
{
    try
    {
        int count = await Source.CountAsync(board);
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
