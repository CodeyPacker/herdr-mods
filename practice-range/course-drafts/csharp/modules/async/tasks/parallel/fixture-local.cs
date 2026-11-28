// The checks provide the results after your method has started both reads.
public static class PairSource
{
    private static List<TaskCompletionSource<int>> reads = new List<TaskCompletionSource<int>>();
    private static System.Threading.CancellationToken expected;
    public static List<string> Shops { get; private set; } = new List<string>();
    public static bool TokensMatch { get; private set; }
    public static void Reset(System.Threading.CancellationToken token)
    {
        reads = new List<TaskCompletionSource<int>>();
        Shops = new List<string>();
        expected = token;
        TokensMatch = true;
    }
    public static Task<int> ReadAsync(string shop, System.Threading.CancellationToken token)
    {
        Shops.Add(shop);
        TokensMatch = TokensMatch && token == expected;
        var read = new TaskCompletionSource<int>();
        reads.Add(read);
        token.Register(() => read.TrySetCanceled(token));
        return read.Task;
    }
    public static void Complete(int first, int second, bool fail)
    {
        if (fail) reads[0].SetException(new InvalidOperationException("Source is offline."));
        else reads[0].SetResult(first);
        reads[1].SetResult(second);
    }
}
