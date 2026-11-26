public static async Task<int> CountOrAsync(string board, int fallback)
{
    int count = await Source.CountAsync(board);
    return fallback;
}
