public static async Task<int> TotalTogetherAsync(string first, string second, System.Threading.CancellationToken cancellationToken)
{
    int a = await PairSource.ReadAsync(first, cancellationToken);
    int b = await PairSource.ReadAsync(second, cancellationToken);
    return a + b;
}
