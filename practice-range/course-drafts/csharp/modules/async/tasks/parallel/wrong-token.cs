public static async Task<int> TotalTogetherAsync(string first, string second, System.Threading.CancellationToken cancellationToken)
{
    var a = PairSource.ReadAsync(first, System.Threading.CancellationToken.None);
    var b = PairSource.ReadAsync(second, System.Threading.CancellationToken.None);
    var counts = await Task.WhenAll(a, b);
    return counts[0] + counts[1];
}
