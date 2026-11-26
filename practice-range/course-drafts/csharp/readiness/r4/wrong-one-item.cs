public static async Task<T> ReadOrAsync<T>(IReader<T> reader, T fallback)
{
    try
    {
        return await reader.ReadAsync();
    }
    catch (InvalidOperationException)
    {
        return fallback;
    }
}

public static bool LastOrCheck(Func<List<int>, int, int> candidate)
{
    return candidate(new List<int> { 9 }, 0) == 9
        && candidate(new List<int>(), 7) == 7;
}
