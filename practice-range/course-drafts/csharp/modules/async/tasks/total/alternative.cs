public static async Task<int> TotalAsync(string first, string second)
{
    int total = 0;
    foreach (string board in new string[] { first, second })
    {
        total = total + await Source.CountAsync(board);
    }
    return total;
}
