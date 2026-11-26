public static async Task<T> ReadOrAsync<T>(IReader<T> reader, T fallback)
{
    await Task.Yield();
    return fallback;
}

public static bool LastOrCheck(Func<List<int>, int, int> candidate)
{
    return true;
}
