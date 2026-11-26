public static async Task<T> ReadOrAsync<T>(IReader<T> reader, T fallback)
{
    T result = fallback;
    try
    {
        result = await reader.ReadAsync();
    }
    catch (InvalidOperationException)
    {
    }
    return result;
}

public static bool LastOrCheck(Func<List<int>, int, int> candidate)
{
    if (candidate(new List<int> { 1, 2, 3 }, -1) != 3)
    {
        return false;
    }
    return candidate(new List<int>(), -1) == -1;
}
