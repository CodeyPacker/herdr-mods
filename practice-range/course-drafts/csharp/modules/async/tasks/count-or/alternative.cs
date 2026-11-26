public static async Task<int> CountOrAsync(string board, int fallback)
{
    int result = fallback;
    try
    {
        int count = await Source.CountAsync(board);
        result = count;
    }
    catch (InvalidOperationException)
    {
    }
    return result;
}
