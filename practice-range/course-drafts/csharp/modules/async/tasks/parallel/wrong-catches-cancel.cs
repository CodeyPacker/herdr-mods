public static async Task<int> TotalTogetherAsync(string first, string second, System.Threading.CancellationToken cancellationToken)
{
    var a = PairSource.ReadAsync(first, cancellationToken);
    var b = PairSource.ReadAsync(second, cancellationToken);
    try { var counts = await Task.WhenAll(a, b); return counts[0] + counts[1]; }
    catch (OperationCanceledException) { return 0; }
}
