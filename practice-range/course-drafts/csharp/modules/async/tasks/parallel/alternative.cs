public static async Task<int> TotalTogetherAsync(string first, string second, System.Threading.CancellationToken cancellationToken)
{
    var reads = new List<Task<int>>();
    foreach (string shop in new string[] { first, second })
    {
        reads.Add(PairSource.ReadAsync(shop, cancellationToken));
    }
    int total = 0;
    foreach (int count in await Task.WhenAll(reads)) total += count;
    return total;
}
