public static async Task<int> TotalTogetherAsync(string first, string second, System.Threading.CancellationToken cancellationToken)
{
    Task<int> a = PairSource.ReadAsync(first, cancellationToken);
    Task<int> b = PairSource.ReadAsync(second, cancellationToken);
    int[] counts = await Task.WhenAll(a, b);
    return counts[0] + counts[1];
}
