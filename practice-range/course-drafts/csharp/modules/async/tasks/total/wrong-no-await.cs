public static async Task<int> TotalAsync(string first, string second)
{
    int a = await Source.CountAsync(first);
    int b = Source.CountAsync(second);
    return a + b;
}
