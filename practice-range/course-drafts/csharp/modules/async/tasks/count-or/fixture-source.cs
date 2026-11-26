// Supplied local source. It uses no network and no clock.
public static class Source
{
    public static async Task<int> CountAsync(string board)
    {
        await Task.Yield();
        if (board == "offline")
        {
            throw new InvalidOperationException("Board is offline.");
        }
        if (board == "desk")
        {
            return 3;
        }
        if (board == "lab")
        {
            return 5;
        }
        return 0;
    }
}
