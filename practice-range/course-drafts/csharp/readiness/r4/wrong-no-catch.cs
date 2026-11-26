public static async Task<T> ReadOrAsync<T>(IReader<T> reader, T fallback)
{
    return await reader.ReadAsync();
}

public static bool LastOrCheck(Func<List<int>, int, int> candidate)
{
    return candidate(new List<int> { 4, 9 }, 0) == 9
        && candidate(new List<int>(), 7) == 7;
}
