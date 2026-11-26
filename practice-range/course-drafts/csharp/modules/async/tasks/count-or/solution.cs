public static async Task<int> CountOrAsync(string board, int fallback)
{
    try
    {
        return await Source.CountAsync(board);
    }
    catch (InvalidOperationException)
    {
        return fallback;
    }
}
