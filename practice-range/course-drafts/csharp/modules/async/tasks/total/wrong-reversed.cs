public static async Task<int> TotalAsync(string first, string second)
{
    int b = await Source.CountAsync(second);
    int a = await Source.CountAsync(first);
    return a + b;
}
