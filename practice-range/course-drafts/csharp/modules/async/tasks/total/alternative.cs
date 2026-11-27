public static async Task<int> TotalAsync(string first, string second)
{
    int total = 0;
    foreach (string shop in new string[] { first, second })
    {
        total = total + await Source.CountAsync(shop);
    }
    return total;
}
